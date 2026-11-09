# Routes and screens

| Route             | Screen             | Status                                                                                                    |
| ----------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| `/`               | Home placeholder   | Scaffold only; product screen is not designed                                                             |
| `/dev/components` | Component Sheet    | Development-only component and state showcase; reusable phone and token fields are available to app forms |
| `/maintenance`    | Maintenance notice | Temporary service availability notice                                                                     |
| `/offline`        | Offline notice     | Connection recovery guidance                                                                              |
| Not found         | 404                | Shared missing-page state                                                                                 |
| Forbidden         | 403                | Next.js forbidden boundary state                                                                          |
| Error boundary    | 500                | Shared retryable error state                                                                              |
| `/host/*`         | Host application   | Redirected to `/` when `host_session` cookie is absent                                                    |
