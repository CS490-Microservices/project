
const db = require('mysql');
const jwt = require('njwt')

exports.handler = async (event) => {
    const signedToken = await verifyToken(event.authorizationToken);

    if(!signedToken) {
        return denyAllPolicy();
    }
    
    const validToken = await checkToken(event.authorizationToken);

    if (validToken) {
        return allowPolicy(event.methodArn);
    }

    return denyAllPolicy();
};

function verifyToken(token) {
    return new Promise((resolve, _) => {
        jwt.verify(token, process.env['jwtTokenSecretPhrase'], function (err, _) {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

function checkToken(token) {
    return new Promise((resolve, _) => {
        const con = db.createConnection({
            host: process.env['dbHost'],
            user: process.env['dbUser'],
            password: process.env['dbPass'],
            database: process.env['dbName']
        });

        con.connect(function (err) {
            if (err) resolve(false);
            con.query("SELECT * FROM jwtTokens WHERE token = ?", [token], function (err, result) {
                if (err) resolve(false);
                if (result.length > 0) {
                    resolve(true);
                }
                resolve(false);
            });
        });
    });
}

function denyAllPolicy() {
    return {
        "principalId": "*",
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "*",
                    "Effect": "Deny",
                    "Resource": "*"
                }
            ]
        }
    }
}

function allowPolicy(methodArn) {
    return {
        "principalId": "apigateway.amazonaws.com",
        "policyDocument": {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": "Allow",
                    "Resource": methodArn
                }
            ]
        }
    }
}