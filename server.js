const express = require('express')
const app = express()
const cors = require('cors')

app.use(cors())
app.use(express.json())

require('./auth')(app)

app.listen(3000)