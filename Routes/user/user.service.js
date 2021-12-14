
const User = require('./user.model');
const bcryptJs = require('bcryptjs');
const { createOtp } = require('./../../utils')
const redis = require('./../../redis');
const { sendMail } = require('./../../mailGateWays');

class UserServices {


    async FetchUserService(req, res) {
        res.status(200).send({ user: req.user, token: req.token, msg: "User Found.", status: true });
    }



    async LoginUserService(req, res) {
        try {
            let user = await User.findOne({ $or: [{ email: req.body.username }, { username: req.body.username }] });

            if (!user) return res.status(404).send({ msg: "Wrong Username" });

            let isValid = await bcryptJs.compare(req.body.password, user.password);
            if (!isValid) return res.status(400).send({ msg: "You are using wrong password.." });
            const token = await user.genUserToken();

            res.status(200).send({ user: user, token: token, msg: "Logged in." });
        } catch (error) {

            return res.status(400).send({ msg: "Error try again.." });

        }
    }



    async RegisterUserService(req, res) {
        try {
            let user = await User.create(req.body);
            res.status(201).send({ user: user, msg: "User Created.", status: true })
        } catch (error) {
            res.status(400).send({ msg: error.message });
        }
    }



    async UpdateUserService(req, res) {
        try {
            let data = req.body;
            req.user.name = data.name || req.user.name;
            req.user.email = data.email || req.user.email;
            req.user.number = data.number || req.user.number;
            req.user.username = data.username || req.user.username;
            if (req.files) {
                req.files.img.mv('public /' + req.user.username + '.jpeg');
                req.user.img = 'public /' + req.user.username + '.jpeg';
            }
            await req.user.save();
            res.status(200).send({ user: req.user, msg: "Updated", status: true });
        } catch (error) {
            res.status(400).send({ msg: error.message });
        }
    }

    async requestAcVerification(req, res) {
        try {
            let otp = createOtp();
            await redis.set(req.user.username, otp, 'EX', 10 * 60 * 5);
            await sendMail([req.user.email], { subject: "Account Verification", text: `Your one time password for account verification is ${otp}` });
            res.status(200).send({ message: "OTP sended" })
        } catch (error) {
            res.status(500).send({ message: error.message });
        }
    }

    async VerifyUserAccount(req, res) {
        try {
            let { code } = req.params;
            let redisToken = await redis.get(req.user.username);
            if (redisToken && code && redisToken == code) {
                req.user.status = true;
                req.user.save();
                await sendMail([req.user.email], { subject: "A/C Verification status", text: "Dear user your account verified successfully.." });
                redis.del(req.user.username);
                return res.status(200).send({ message: ' Account verified' });
            }
            res.status(400).send({ message: 'your one time password for account verification is worng' });
        } catch (error) {
            res.status(400).send({ msg: error.message });
        }
    }



    async CheckUsernameService(req, res) {
        try {
            let { username } = req.params;
            let user = await User.findOne({ $or: [{ email: username }, { username: username }] });
            if (!user) return res.status(404).send({ msg: "This username is not registerd.", status: false });
            else return res.status(200).send({ msg: "This username is already regiseterd.", status: true })
        } catch (error) {
            res.status(400).send({ error: error.message });
        }
    }



    async LogoutUserService(req, res) {
        try {
            let lis = req.user.tokens;
            req.user.tokens = [];
            let list = [];
            lis.forEach((e) => {
                if (e.token !== req.token) list.push(e);
            })
            req.user.tokens = list;
            await req.user.save();
            return res.status(200).send({ msg: "Logged out." });
        } catch (error) {
            res.status(400).send({ msg: error.message });
        }
    }


    async ChangeUserPassword(req, res) {
        try {
            let { oldPassword, newPassword } = req.body;
            let isValid = bcryptJs.compare(oldPassword, req.user.password);
            if (!isValid) return res.status(404).send({ msg: "Your Old Password id invalid", status: false });
            req.user.password = newPassword;
            await req.user.save();
            res.status(200).send({ msg: "Password was updated.", status: true })
        } catch (error) {
            res.status(400).send({ msg: error.message })
        }
    }
}

const UserService = new UserServices();
module.exports = {
    UserService
}