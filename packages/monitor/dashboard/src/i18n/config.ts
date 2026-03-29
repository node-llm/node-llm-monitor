/**
 * i18n configuration for NodeLLM Monitor Dashboard.
 * Supports dynamic YAML-based locale loading.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import yaml from "js-yaml";

/**
 * Dynamically import all YAML files from the locales directory.
 * Vite's import.meta.glob allows us to load all files matching a pattern.
 * { eager: true, query: '?raw', import: 'default' } gives us the raw strings of each file.
 */
const localeFiles = import.meta.glob("./locales/*.yml", {
  eager: true,
  query: "?raw",
  import: "default"
}) as Record<string, string>;

const resources: any = {};
const supportedLngs: string[] = [];

// Build the resources object by extracting the language code from the filename
// e.g., "./locales/en.yml" -> "en"
Object.entries(localeFiles).forEach(([path, content]) => {
  // Extract filename without extension, handling both ./locales/en.yml and locales/en.yml
  const filename = path.split("/").pop() || "";
  const langMatch = filename.match(/^([^.]+)\.yml$/);

  if (langMatch) {
    const lang = langMatch[1];
    resources[lang] = {
      translation: yaml.load(content)
    };
    supportedLngs.push(lang);
  }
});

i18n.use(initReactI18next).init({
  resources,
  supportedLngs,
  lng: localStorage.getItem("monitor_lng") || import.meta.env.VITE_DEFAULT_LANGUAGE || "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false // react already safes from xss
  }
});

/**
 * Primary configuration function for host applications.
 * Use this to restrict supported languages or set defaults.
 */
export function configureI18n(options: {
  supportedLngs?: string[];
  fallbackLng?: string;
  lng?: string;
  title?: string;
}) {
  if (options.supportedLngs) {
    i18n.options.supportedLngs = options.supportedLngs;
  }
  if (options.fallbackLng) {
    i18n.options.fallbackLng = options.fallbackLng;
  }
  if (options.lng) {
    i18n.changeLanguage(options.lng);
  }
  if (options.title) {
    const langs = options.supportedLngs || (i18n.options.supportedLngs as string[]) || ["en"];
    langs.forEach((lng) => {
      i18n.addResourceBundle(
        lng,
        "translation",
        { dashboard: { title: options.title } },
        true,
        true
      );
    });
  }
}

/**
 * Public API to extend i18n from consumer applications.
 * Use this to add new languages (like Portuguese) or override existing translations.
 *
 * @param source - Multiple input types supported:
 *                 1. Path/URL to a YAML file (e.g. '/locales/pt.yml')
 *                 2. Raw YAML string
 *                 3. Record object with language keys
 * @param enable - If true (default), adds newly defined languages to the supported list.
 */
export async function extendI18n(source: string | Record<string, any>, enable = true) {
  let resources: Record<string, any>;

  if (typeof source === "string") {
    let yamlContent = source;

    // If it looks like a path or URL, fetch it
    if (source.endsWith(".yml") || source.endsWith(".yaml") || source.startsWith("http")) {
      try {
        const response = await fetch(source);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        yamlContent = await response.text();
      } catch (e) {
        console.error("Failed to fetch YAML file for i18n extension:", e);
        return;
      }
    }

    try {
      resources = yaml.load(yamlContent) as Record<string, any>;
    } catch (e) {
      console.error("Failed to parse YAML for i18n extension:", e);
      return;
    }
  } else {
    resources = source;
  }

  if (!resources) return;

  Object.entries(resources).forEach(([lng, bundle]) => {
    // If it's a direct translation object, fix it up
    const translation = bundle.translation || bundle;
    i18n.addResourceBundle(lng, "translation", translation, true, true);

    // Ensure the language is added to the supported list if enabled
    if (enable) {
      const currentList = (i18n.options.supportedLngs as string[]) || [];
      if (!currentList.includes(lng)) {
        currentList.push(lng);
        i18n.options.supportedLngs = currentList;
      }
    }
  });
}

export default i18n;
