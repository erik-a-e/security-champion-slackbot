# Security Champion Slackbot

For oppfølging av Security Champions

### Konfigurasjon

| Environment-variabel    | Obligatorisk | Default-verdi                          | Forklaring                                                  |
| ----------------------- | ------------ | -------------------------------------- | ----------------------------------------------------------- |
| TEAMKATALOG_API_URL     | Ja           | `https://teamkatalog.nais.adeo.no/api` | URL til teamkatalog-APIet                                   |
| TEAMKATALOG_MRH_SESSION | Nei          |                                        | MRHSession-cookie for bruk av teamkatalog-APIet utenfor FSS |
| SLACK_BOT_TOKEN         | Ja           |                                        | Slack bot token                                             |
| SLACK_SIGNING_SECRET    | Ja           |                                        | Slack signing secret                                        |
| DRY_RUN                 | Nei          | `false`                                | Dry-run-modus deaktiverer endringer                         |
