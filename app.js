import express, { static } from 'express';
const app = express()
const port = 3000

app.use(static('public'))

app.listen(port, () => console.log(`Example app listening on port ${port}!`))