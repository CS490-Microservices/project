
const db = require('mysql');
const jwt = require('njwt')
const bcrypt = require('bcrypt');

exports.handler = async (event) => {
    const username = event.queryStringParameters['username'];
    const password = event.queryStringParameters['password'];
    const user_id = await verifyUser(username, password);
    if (user_id !== null) {
        
        const tokenString = await createToken(user_id);
        if (tokenString) {
            const response = {
                statusCode: 200,
                body: JSON.stringify({status: 'success', token: tokenString}),
            };
            return response;
        }
    }
    const response = {
        statusCode: 403,
        body: JSON.stringify('error'),
    };
    return response;
};

function verifyUser(username, password) {
    return new Promise((resolve, _) => {
        const con = db.createConnection({
            host: process.env['dbHost'],
            user: process.env['dbUser'],
            password: process.env['dbPass'],
            database: process.env['dbName']
        });

        con.query("SELECT user_id, hash FROM users WHERE username = ?", [username], function (err, result) {
            if (err) {
                console.log(err);
                resolve(null);
            } else if (result.length > 0) {
                const user_id = result[0].user_id;
                const hash = result[0]['hash'];
                bcrypt.compare(password, hash, function(err, result) {
                    if(err) {
                        console.log(err);
                        resolve(null);
                    } else if(result) {
                        resolve(user_id);
                    }
                });
            } else {
                resolve(null);
            }
        });
    });
}

function createToken(user_id) {
    const claims = {
        iss: "http://localhost:3000",
        sub: user_id,
        scope: "self, admins"
    }
    const token = jwt.create(claims, process.env['jwtTokenSecretPhrase']);
    token.setExpiration(new Date().getTime() + 60 * 1000 * 60 * 24  * 2)
    return new Promise((resolve, _) => {
        const con = db.createConnection({
            host: process.env['dbHost'],
            user: process.env['dbUser'],
            password: process.env['dbPass'],
            database: process.env['dbName']
        });

        con.connect(function (err) {
            if (err) {
                resolve(false);
            } else {
                const tokenString = token.compact();
                con.query("INSERT INTO jwtTokens (user_id, token) VALUES(?, ?)", [user_id, tokenString], function (err, result) {
                    if (err) {
                        console.log(err)
                        resolve(false);
                    } else {
                        resolve(tokenString);
                    }
                });
            }
        });
    });
}
