# Outreach platform tutorials

- `embed-handout-in-apollo.mp4` — embed a personalized Handout in Apollo.
- `embed-handout-in-instantly.mp4` — embed a personalized Handout in Instantly.
- `find-platform-variables.mp4` — find the recipient variables required by an outreach platform.

## Personalization variables

| Platform | First name | Company name | Company domain |
| --- | --- | --- | --- |
| Apollo | `{{contact.first_name}}` | `{{account.name}}` | `{{account.domain}}` |
| Instantly | `{{firstName}}` | `{{companyName}}` | `{{companyDomain}}` |
| Outreach | `{{first_name}}` | `{{account.name}}` | `{{account.domain}}` |
| Salesloft | `{{first_name}}` | `{{account_name_or_company}}` | `{{Account.domain}}` |
| Lemlist | `{{firstName}}` | `{{companyName}}` | `{{companyDomain}}` |
