# Security Policy

## Supported Versions

We actively provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

**If you discover a security vulnerability, please do NOT open a public issue.**

We take the security of NodeLLM Monitor seriously. If you believe you have found a vulnerability—especially related to PII leakage, data exposure, or unauthorized access to monitoring data—please report it privately.

Please send your report via email to: **eshaiju@gmail.com**

Your report should include:

- A description of the vulnerability.
- A minimal reproduction case (if possible).
- Any potential impact on production systems.

We will acknowledge your report within 48 hours and provide a timeline for a fix and public disclosure.

## Security Philosophy: Privacy by Default

NodeLLM Monitor is built with **privacy by default**:

- **`captureContent: false`**: By default, we do NOT capture prompts or responses. This ensures PII is never persisted unless explicitly enabled.
- **Content Scrubbing**: When content capture is enabled, automatic scrubbing of PII (emails, phone numbers, SSNs, credit cards) is available.
- **Secrets Detection**: API keys, tokens, and other secrets are automatically redacted when scrubbing is enabled.

For more details on configuring privacy settings, see the [README](./README.md).
