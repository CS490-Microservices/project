import json
import boto3
import base64
import os
import pymysql
import uuid
s3 = boto3.client('s3')



def lambda_handler(event,context):
    body = json.loads(event['body'])
    
    type = body['type']
    filetype = type.split('/')[1]
    bucket = os.environ['bucket']
    fileName = str(uuid.uuid1()) + "." +  filetype
    filecontent = body['content']
    token = body['token']
    dbUser = os.environ['dbUser']
    dbPass = os.environ['dbPass']
    dbAddress = os.environ['dbAddress']
    dbName = os.environ['dbName']
    databaseConnection = pymysql.connect(dbAddress, dbUser, dbPass, dbName)    
    cursor = databaseConnection.cursor()
    cursor.execute("SELECT user_id FROM jwtTokens WHERE token=%s;", (token))
    userid = cursor.fetchall()[0][0]
    cursor.execute(""" INSERT INTO image(path,user_id) VALUES('%s',%s);""" %(fileName,int(userid)))
    databaseConnection.commit()
    databaseConnection.close()
    s3.put_object(Bucket=bucket, Key=fileName,Body=base64.b64decode(filecontent.encode()), ContentType=type)
    return {'statusCode': 200,
            'headers': {
              'Access-Control-Allow-Origin': '*'  
            },
        'body': json.dumps('Image Uploaded Successfully!')}

