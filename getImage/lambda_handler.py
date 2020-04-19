import json
import boto3
import base64
import os
from io import BytesIO
import pymysql
import uuid
s3 = boto3.client('s3')

def lambda_handler(event, context):
    bucket = os.environ['bucket']
    limit = int(os.environ['limit'])
    output = list()
    if event['queryStringParameters'] is None:
        event['queryStringParameters'] = {}
    tag = event['queryStringParameters']['tag'] if 'tag' in event['queryStringParameters'] else None
    username = event['queryStringParameters']['username'] if 'username' in event['queryStringParameters'] else None
    dbUser = os.environ['dbUser']
    dbPass = os.environ['dbPass']
    dbAddress = os.environ['dbAddress']
    dbName = os.environ['dbName']
    databaseConnection = pymysql.connect(dbAddress, dbUser, dbPass, dbName)    
    cursor = databaseConnection.cursor()
    if tag and not username:
        cursor.execute("select username, path, tag from userimages where tag=%s;",(tag))
        imagepath = cursor.fetchall()
        for i in range(len(imagepath)):
            output.append({'path': imagepath[i][1], 'user': imagepath[i][0], 'tag': imagepath[i][2]})
    elif username and not tag:
        cursor.execute("select username, path, tag from userimages where username=%s;",(username))
        imagepath = cursor.fetchall()
        for i in range(len(imagepath)):
            output.append({'path': imagepath[i][1], 'user': imagepath[i][0], 'tag': imagepath[i][2]})
    elif tag and username:
        cursor.execute("select username, path, tag from userimages where username=%s and tag=%s;",(username,tag))
        imagepath = cursor.fetchall()
        for i in range(len(imagepath)):
            output.append({'path': imagepath[i][1], 'user': imagepath[i][0], 'tag': imagepath[i][2]})
    else:
        cursor.execute("select username, path, tag from userimages LIMIT %s;", (limit))
        imagepath = cursor.fetchall()
        for i in range(len(imagepath)):
            output.append({'path': imagepath[i][1], 'user': imagepath[i][0], 'tag': imagepath[i][2]})
        
    
    return {'statusCode': 200,
            'headers': {
              'Access-Control-Allow-Origin': '*'  
            },
            'body': json.dumps(output)}
