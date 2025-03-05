import express from 'express';
import { main } from './main.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.post('/main', (req, res) => {
    try {
        main();
        res.send('Emails sent successfully!');
    }
    catch (error) {
        console.error('Error sending emails:', error.message);
        res.status(500).send('Error sending emails');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});