import json
import pymysql
import sys
from passlib.hash import bcrypt
import os


def lambda_handler(event, context):
    db_host = os.environ['dbHost']
    db_user = os.environ['dbUser']
    db_pass = os.environ['dbPass']
    db_name = os.environ['dbName']
    db = pymysql.connect(db_host, db_user, db_pass, db_name)
    cursor = db.cursor()
    cursor.execute(
        "SELECT hash FROM users WHERE username=%s;", (event["queryStringParameters"]["user"],))
    if len(cursor.fetchall()) != 0:
        return {
            'statusCode': 422,
            'headers': {
              'Access-Control-Allow-Origin': '*'  
            }
        }
    cursor.execute("INSERT INTO users(username, hash) VALUES(%s, %s);",
                   (event["queryStringParameters"]["user"], bcrypt.using(rounds=4).hash(event["queryStringParameters"]["password"])))
    db.commit()
    db.close()
    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*'  
        }
    }
