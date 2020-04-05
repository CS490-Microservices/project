import json
import boto3
import botocore
import pymysql
import sys
from passlib.hash import sha256_crypt
import passlib

s3_connector = boto3.resource('s3', 'us-east-2', config=botocore.config.Config(s3={'addressing_style':'path'}))


def lambda_handler(event, context):
    dbUser = "Lambda"
    dbpass = s3_connector.Object("imageserviceauthconfigs", "dbpass.txt").get()['Body'].read().decode('utf-8')
    dbaddress = s3_connector.Object("imageserviceauthconfigs", "dbaddress.txt").get()['Body'].read().decode('utf-8')
    dbname = s3_connector.Object("imageserviceauthconfigs", "dbname.txt").get()['Body'].read().decode('utf-8')
    databaseConnection = pymysql.connect(dbaddress, dbUser, dbpass, dbname)    cursor = databaseConnection.cursor()
    cursor.execute("SELECT hash FROM authtable WHERE username=%s;", (event["user"],))
    hash = cursor.fetchall()[0][0]
    statusCode = 500
    if(sha256_crypt.verify(event["password"], hash)):
        statusCode = 200
    else:
        statusCode = 401
    databaseConnection.close()
    return {
        'statusCode': statusCode,
    }

