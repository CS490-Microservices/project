import json
import boto3
import botocore
import pymysql
import sys
from passlib.hash import sha256_crypt
import passlib

s3_connector = boto3.resource('s3', 'us-east-2', config=botocore.config.Config(s3={'addressing_style':'path'}))


def lambda_handler(event, context):
    dbuser = "Lambda"
    print(dbuser)
    dbpass = s3_connector.Object("imageserviceauthconfigs", "dbpass.txt").get()['Body'].read().decode('utf-8')
    dbaddress = s3_connector.Object("imageserviceauthconfigs", "dbaddress.txt").get()['Body'].read().decode('utf-8')
    dbname = s3_connector.Object("imageserviceauthconfigs", "dbname.txt").get()['Body'].read().decode('utf-8')
    print(dbaddress)
    databaseConnection = pymysql.connect(dbaddress, dbuser, dbpass, dbname)
    print(databaseConnection)
    cursor = databaseConnection.cursor()
    cursor.execute("SELECT hash FROM authtable WHERE username=%s;", (event["user"],))
    if len(cursor.fetchall()) != 0:
        return {
            'statusCode': 422,
        }
    cursor.execute("INSERT INTO authtable(username, hash) VALUES(%s, %s);", (event["user"], sha256_crypt.hash(event["password"])))
    databaseConnection.commit()
    databaseConnection.close()
    return {
        'statusCode': 200,
    }

