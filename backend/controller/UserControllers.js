// controller for user
const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/UserSchema');
const { Journal, PRIVACY } = require('../models/JournalSchema');

// Request Body Format
// {
//  'name': 'name',
//  'email': 'test@test.com',
//  'password': 'abc123',
// }
// Response Format
// {
//     status: 400/500
//     message: [
//                 'Invalid request body',
//                 'INVALID_EMAIL',
//                 'EMAIL_EXISTS',
//                 'WEAK_PASSWORD : Password should be at least 6 characters',
//                 'Firebase Server Error',
//                 'Sign Up successful Database error'
//              ]
// }
// {
//     status: 200,
//     idToken: firebaseResponse.data.idToken,
//     refreshToken: firebaseResponse.data.refreshToken,
//     expiresIn: firebaseResponse.data.expiresIn,
//     userData: {
//         name: name,
//         email: email,
//         _id: firebaseResponse.data.localId,
//         'likes': [],
//         'collections': []
//         '__v': 0
//     }
// }
const signUp = async (req, res) => {
    const { email, password, name } = req.body;

    let firebaseResponse = {};
    let response = {};

    if (!email || !password || !name) {
        return res
            .status(400)
            .json({ status: 400, message: 'Invalid request body' });
    }

    // Step One: Firebase
    try {
        firebaseResponse = await axios.post(
            'https://identitytoolkit.googleapis.com/v1/accounts:signUp',
            {
                email: email,
                password: password,
                returnSecureToken: true,
            },
            {
                params: { key: process.env.FIREBASE_KEY },
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (firebaseErr) {
        if (firebaseErr.response.data.error.message) {
            response = {
                status: 400,
                message: firebaseErr.response.data.error.message,
            };
            return res.status(400).json(response);
        }
        return res
            .status(500)
            .json({ status: 500, message: 'Firebase Server Error' });
    }

    // Step Two: our database
    const newUser = new User({
        name,
        email,
        _id: firebaseResponse.data.localId,
    });
    try {
        await newUser.save();
    } catch (err) {
        return res.status(500).json({
            status: 500,
            message: 'Sign Up successful Database error',
        });
    }

    response = {
        status: 200,
        idToken: firebaseResponse.data.idToken,
        refreshToken: firebaseResponse.data.refreshToken,
        expiresIn: firebaseResponse.data.expiresIn,
        userData: {
            name: newUser.name,
            email: newUser.email,
            likes: newUser.likes
        },
    };
    return res.status(200).json(response);
};

// Request Body Format
// {
//  'email': 'test@test.com',
//  'password': 'abc123',
// }
// Response Format
// {
//     status: 400/500
//     message: [
//                 'Invalid request body',
//                 'INVALID_EMAIL',
//                 'EMAIL_NOT_FOUND',
//                 'INVALID_PASSWORD',
//                 'Firebase Server Error',
//                 'Database Error'
//              ]
// }
// {
//     status: 200,
//     idToken: firebaseResponse.data.idToken,
//     refreshToken: firebaseResponse.data.refreshToken,
//     expiresIn: firebaseResponse.data.expiresIn,
//     userData: {
//         name: name,
//         email: email,
//         _id: firebaseResponse.data.localId
//         'likes': [aaa,bbb,ccc],
//         'collections': [aaa,bbb,ccc],
//         '__v': 0
//     }
// }
const login = async (req, res) => {
    const { email, password } = req.body;

    let firebaseResponse = {};
    let response = {};

    if (!email || !password) {
        return res
            .status(400)
            .json({ status: 400, message: 'Invalid request body' });
    }

    // Step One: Verify in Firebase
    try {
        firebaseResponse = await axios.post(
            'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
            {
                email: email,
                password: password,
                returnSecureToken: true,
            },
            {
                params: { key: process.env.FIREBASE_KEY },
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (firebaseErr) {
        if (firebaseErr.response.data.error.message) {
            response = {
                status: 400,
                message: firebaseErr.response.data.error.message,
            };
            return res.status(400).json(response);
        }
        return res
            .status(500)
            .json({ status: 500, message: 'Firebase Server Error' });
    }

    // Step Two: Verify in our database
    let foundUser;
    try {
        foundUser = await User.findById(firebaseResponse.data.localId);
        // email already signed up with firebase, not yet synced into our own DB.
        if (!foundUser) {
            const newUser = new User({
                name: 'Please update your name',
                email,
                _id: firebaseResponse.data.localId,
            });
            await newUser.save();
            foundUser = newUser;
        }
    } catch (err) {
        return res.status(500).json({ status: 500, message: 'Database Error' });
    }

    response = {
        status: 200,
        idToken: firebaseResponse.data.idToken,
        refreshToken: firebaseResponse.data.refreshToken,
        expiresIn: firebaseResponse.data.expiresIn,
        userData: {
            name: foundUser.name,
            email: foundUser.email,
            likes: foundUser.likes
        },
    };
    return res.status(200).json(response);
};

const getUserInfoHelper = async (req, res, isSecure) => {
    const idtoken = req.params.idToken;
    let firebaseResponse = {};

    if (!idtoken) {
        return res
            .status(400)
            .json({ status: 400, message: 'Invalid request body' });
    }

    // Step One: call Firebase
    try {
        firebaseResponse = await axios.post(
            'https://identitytoolkit.googleapis.com/v1/accounts:lookup',
            {
                idToken: idtoken,
            },
            {
                params: { key: process.env.FIREBASE_KEY },
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (firebaseErr) {
        if (firebaseErr.response.data.error.message) {
            let response = {
                status: 400,
                message: firebaseErr.response.data.error.message,
            };
            return res.status(400).json(response);
        }
        return res
            .status(500)
            .json({ status: 500, message: 'Firebase Server Error' });
    }

    // Step Two: Get User Info from our database
    const userid = firebaseResponse.data.users[0].localId;
    let userData;

    try {
        if (isSecure) {
            userData = await User.findById(userid);
        } else {
            userData = await User.findById(userid, '-_id');
        }
    } catch (err) {
        return res.status(500).json({ status: 500, message: 'Database Error' });
    }

    return res.status(200).json({ status: 200, userData: userData });
};

// Request Body Format
// {
//  'idToken': 'firebase idToken took from authContext.token',
// }
// Response Format
// {
//     'status': 200,
//     'userData': {
//         'likes': [],
//         'collections': [],
//         'name': 'test',
//         'email': 'test@test.com',
//         '__v': 0,
//         '_id': 'wHoVreiPACc0BjVYyHPEBooQejD3', -- if secure route is used, id will be returned
//     }
// }
// {
//     status: 400/500
//     message: [
//                 'INVALID_ID_TOKEN' -- The user's credential is no longer valid. The user must sign in again,
//                 'USER_NOT_FOUND' -- There is no user record corresponding to this identifier. The user may have been deleted,
//                 'Firebase Server Error',
//                 'Database Error'
//              ]
// }
const getUserInfo = async (req, res) => {
    return await getUserInfoHelper(req, res, false);
};
const getUserInfoSecure = async (req, res) => {
    return await getUserInfoHelper(req, res, true);
};

// get user info by user_id, for BE only
// req-param: user_id
// req-body: null
// response: the User JSON
const getUserInfoById = async (req, res) => {
    let userData;
    try {
        userData = await User.findById(req.params.user_id, '-_id');
    } catch (err) {
        return res.status(500).json({ status: 500, message: 'Database Error' });
    }
    return res.status(200).json({ status: 200, data: userData });
};

const refreshUserIdToken = async (req, res) => {
    let firebaseResponse = {};
    let response = {};
    let userData;

    if (!req.body.grant_type || !req.body.refresh_token) {
        return res
            .status(400)
            .json({ status: 400, message: 'Invalid request body' });
    }

    // Step One: Firebase
    try {
        firebaseResponse = await axios.post(
            'https://securetoken.googleapis.com/v1/token',
            req.body,
            {
                params: { key: process.env.FIREBASE_KEY },
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (firebaseErr) {
        if (firebaseErr.response.data.error.message) {
            response = {
                status: 400,
                message: firebaseErr.response.data.error.message,
            };
            return res.status(400).json(response);
        }
        return res
            .status(500)
            .json({ status: 500, message: 'Firebase Server Error' });
    }
    try {
        userData = await User.findById(firebaseResponse.data.user_id, '-_id');
    } catch(err) {
        return res
            .status(500)
            .json({ status: 500, message: 'Internal Server Error' });
    }
    response = {
        status: 200,
        idToken: firebaseResponse.data.id_token,
        refreshToken: firebaseResponse.data.refresh_token,
        expiresIn: firebaseResponse.data.expires_in,
        userData: userData
    };
    return res.status(200).json(response);
};

// body format:
// {
//  "journalId": "",
//  "idToken": ""
// }
const likeJournalHelper = async (req, res, type) => {
    const { journalId, idToken } = req.body;
    let userResponse;
    if (!journalId || !idToken) {
        return res
            .status(400)
            .json({ status: 400, message: 'Invalid request body' });
    }
    try {
        userResponse = await axios.get(process.env.BACKEND_URL + 'users/info/secure/' + idToken);
    } catch (err) {
        return res.status(500).json({ status: 500, message: 'Server Error' });
    }
    const userid = userResponse.data.userData._id;
    let foundUser;
    let foundJournal;
    try {
        foundUser = await User.findById(userid);
        foundJournal = await Journal.findById(journalId);
        if (!foundUser || !foundJournal) {
            return res.status(500).json({ status: 500, message: 'Database Error' });
        }
        if (type === 'like') {
            if (foundUser.likes.includes(journalId) && foundJournal.likedby.includes(userid)) {
                return res.status(200).json({ status: 200, journalId: journalId });
            }
        } else {
            if (!foundUser.likes.includes(journalId) && !foundJournal.likedby.includes(userid)) {
                return res.status(200).json({ status: 200, journalId: journalId });
            }
        }
    } catch (err) {
        return res.status(500).json({ status: 500, message: 'Database Error' });
    }
    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        if (type==='like') {
            foundUser.likes.push(journalId);
            foundJournal.likedby.push(userid);
        } else {
            foundUser.likes.pull(journalId);
            foundJournal.likedby.pull(userid);
        }
        await foundUser.save({ session: sess });
        await foundJournal.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        return res.status(500).json({ status: 500, message: 'Database Error' });
    }

    return res.status(200).json({ status: 200, journalId: journalId });
};

const likeJournal = async (req, res) => {
    likeJournalHelper(req, res, 'like');
};

const unlikeJournal = async (req, res) => {
    likeJournalHelper(req, res, 'unlike');
};

const getLikedJournalsByUserToken = async (req, res) => {
    const idToken = req.params.idToken;
    let userResponse;
    if (!idToken) {
        return res
            .status(400)
            .json({ status: 400, message: 'Invalid request body' });
    }
    try {
        userResponse = await axios.get(process.env.BACKEND_URL + 'users/info/secure/' + idToken);
    } catch (err) {
        return res.status(500).json({ status: 500, message: 'Server Error' });
    }
    const userid = userResponse.data.userData._id;
    let foundUserWithLikes;
    try {
        foundUserWithLikes = await User.findById(userid).populate('likes');
        if (!foundUserWithLikes) {
            return res.status(500).json({ status: 500, message: 'Database Error' });
        }
    } catch(err) {
        return res.status(500).json({ status: 500, message: 'Database Error' });
    }

    let likes = foundUserWithLikes.likes.map(journal => {
        let {author_id, likedby, comments, ...rest} = journal.toObject();
        comments = comments.map(comment => {
            let {author_id, ...rest} = comment;
            return {...rest};
        })
        return {
            ...rest,
            likesNum: likedby.length,
            comments
        }
    });

    likes = likes.filter(journal => {
        let { privacy } = journal;
        return privacy !== PRIVACY.PRIVATE;
    })

    return res.status(200).json({status: 200, likedJournals: likes});

};

// request:
// {
//  token: firebase idToken,
//  password: newpassword
// }
const changePassword = async (req, res) => {
    let firebaseResponse = {};
    let response = {};

    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({status:400, message: 'Invalid request body'});
    }
    try {
        firebaseResponse = await axios.post(
            'https://identitytoolkit.googleapis.com/v1/accounts:update',
            {
                idToken: token,
                password: password,
                returnSecureToken: true,
            },
            {
                params: { key: process.env.FIREBASE_KEY },
                headers: { 'Content-Type': 'application/json' },
            }
        );
    } catch (firebaseErr) {
        if (firebaseErr.response.data.error.message) {
            response = {
                status: 400,
                message: firebaseErr.response.data.error.message,
            };
            return res.status(400).json(response);
        }
        return res
            .status(500)
            .json({ status: 500, message: 'Firebase Server Error' });
    }

    let foundUser;
    try {
        foundUser = await User.findById(firebaseResponse.data.localId);
        // email already signed up with firebase, not yet synced into our own DB.
    } catch (err) {
        return res.status(500).json({ status: 500, message: 'Database Error' });
    }

    response = {
        status: 200,
        idToken: firebaseResponse.data.idToken,
        refreshToken: firebaseResponse.data.refreshToken,
        expiresIn: firebaseResponse.data.expiresIn,
        userData: {
            name: foundUser.name,
            email: foundUser.email,
            likes: foundUser.likes
        },
    };
    return res.status(200).json(response);
};

exports.getUserInfo = getUserInfo;
exports.getUserInfoSecure = getUserInfoSecure;
exports.signUp = signUp;
exports.login = login;
exports.getUserInfoById = getUserInfoById;
exports.refreshUserIdToken = refreshUserIdToken;
exports.likeJournal = likeJournal;
exports.unlikeJournal = unlikeJournal;
exports.getLikedJournalsByUserToken = getLikedJournalsByUserToken;
exports.changePassword = changePassword;