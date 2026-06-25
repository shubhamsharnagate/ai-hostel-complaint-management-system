import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'hostel_secret_key_123_abc')
    MONGO_URI = "mongodb+srv://hostel123:hostel123@cluster0.somsoqv.mongodb.net/?appName=Cluster0"
    DATABASE_NAME = 'hostel_complaint_db'
