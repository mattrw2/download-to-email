# TeamGantt Project PDF Emailer

### Prerequisites
- [Node](https://nodejs.org/en/download)
- [Git](https://git-scm.com/downloads)


### Setup 

1. Clone repository
    ```
    git clone https://github.com/mattrw2/teamgantt-project-emailer.git
    ```
1. CD into the directory
    ```
    cd teamgantt-project-emailer
    ```

1. Install dependencies
    ```
    npm install && npx playwright install
    ```
1. Add a `.env` file at the root of the project. Populate with secrets. See `.env.example`

1. Populate `accounts.json` with client and project data


### Emailing Reports

Create PDFs, save them in the `reports` folder, and send them out to the emails specified in `accounts.json`, and log the succesfully sent emails to `mailLog.csv`. You can optionally pass  `simulate` and `date` as command-line arguments.

__Defaults:__

- `simulate=false`
- `date=today` (in YYYY-MM_DD format)


__Usage:__

- With defaults:
    ```
    npm start
    ```

- With arguments:
    ```
    npm start -- --simulate=true --date=YYYY-MM-DD
    ```
