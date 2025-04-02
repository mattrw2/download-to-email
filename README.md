# TeamGantt Project PDF Emailer

### Setup 

1. Install [Node](https://nodejs.org/en/download)

1. Install dependencies
    ```
    npm install && npx install playwright
    ```
1. Add a `.env` file at the root of the project. Populate with secrets. See `.env.example`

1. Populate `accounts.json` with client and project data.


### Scripts

Create PDFs and save them in the "/reports" folder, but don't send them. 
```
npm run simulate
```

Create PDFs and send them to the email specified in the `accounts.json` file.
```
npm start
```
