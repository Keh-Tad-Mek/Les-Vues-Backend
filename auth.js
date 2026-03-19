const auth = require('better-auth')

module.exports = (app) => {   
    app.post('/api/signup', (req, res) => {
        console.log(req.body)
    })

    app.post('/api/signin', (req, res) => {
        console.log(req.body)
    })

}