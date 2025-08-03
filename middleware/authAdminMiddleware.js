const model = require('./../model/authModel')

const isRegistered = async (req, res, next) => {
    const { email } = req.body

    const user =await model.findUserExist(email);
    console.log(user);

    if (user) {
        return res.status(404).json({ message: 'User exist', user })
    }


    next()
}

module.exports = { isRegistered }