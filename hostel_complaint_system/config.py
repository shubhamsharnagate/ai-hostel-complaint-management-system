import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'hostel_secret_key_123_abc')
    MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')
    DATABASE_NAME = 'hostel_complaint_db'
