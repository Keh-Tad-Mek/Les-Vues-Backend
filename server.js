const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()

app.use(cors({
    origin: process.env.FRONTEND_URL
}))

app.use(express.json())


require('./auth')(app)

app.listen(3000)