# TeamGantt Project PDF Emailer

### Setup 

1. Install [Node](https://nodejs.org/en/download)

1. Install dependencies
    ```
    npm install && npx install playwright
    ```
1. Add a `.env` file at the root of the project. Populate with secrets. See `.env.example`

1. Populate `accounts.json` with client and project data. See `accounts.json.example`


### Scripts

Create PDFs and save them in the "/reports" folder, but don't send them. 
```
npm run dry-run
```

Create PDFs and email them out to the email speciefied in the `accounts.json` file.
```
npm start
```
