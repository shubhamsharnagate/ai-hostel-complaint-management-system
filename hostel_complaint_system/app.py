"""
Hostel Complaint Management System - Flask Backend Server
Author: Final Year B.Tech CSE Student
Database: Local MongoDB (hostel_complaint_db)
AI Features: NLP-based Category Classification & Priority Scoring (Red, Orange, Green)
"""

import os
import uuid
import datetime
import pickle
import re
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from config import Config

# Initialize Flask application
app = Flask(__name__)
app.config.from_object(Config)

# ----------------------------------------
# MongoDB Connection with Graceful Fallback
# ----------------------------------------
try:
    # Attempt to connect to Local MongoDB with 3-second timeout
    client = MongoClient(app.config['MONGO_URI'], serverSelectionTimeoutMS=3000)
    # Check if connection is alive
    client.admin.command('ping')
    db = client[app.config['DATABASE_NAME']]
    users_col = db['users']
    complaints_col = db['complaints']
    mongo_active = True
    print("[+] Successfully connected to local MongoDB at:", app.config['MONGO_URI'])
except (ConnectionFailure, ServerSelectionTimeoutError) as e:
    mongo_active = False
    print("[!] Warning: Could not connect to MongoDB. Running in In-Memory Demo Mode.")
    # In-memory database lists to act as mocks if MongoDB is not running
    mock_users = []
    mock_complaints = []

# ----------------------------------------
# AI Classifier (Naive Bayes + TF-IDF with Rule-based fallback)
# ----------------------------------------
# Attempt to load trained models
base_dir = os.path.dirname(os.path.abspath(__file__))
cat_model_path = os.path.join(base_dir, 'model', 'category_model.pkl')
cat_vec_path = os.path.join(base_dir, 'model', 'category_vectorizer.pkl')
pri_model_path = os.path.join(base_dir, 'model', 'priority_model.pkl')
pri_vec_path = os.path.join(base_dir, 'model', 'priority_vectorizer.pkl')

category_classifier = None
category_vectorizer = None
priority_classifier = None
priority_vectorizer = None

if (os.path.exists(cat_model_path) and os.path.exists(cat_vec_path) and 
    os.path.exists(pri_model_path) and os.path.exists(pri_vec_path)):
    try:
        with open(cat_model_path, 'rb') as f:
            category_classifier = pickle.load(f)
        with open(cat_vec_path, 'rb') as f:
            category_vectorizer = pickle.load(f)
        with open(pri_model_path, 'rb') as f:
            priority_classifier = pickle.load(f)
        with open(pri_vec_path, 'rb') as f:
            priority_vectorizer = pickle.load(f)
        print("[+] AI Classifier models loaded successfully.")
    except Exception as e:
        print(f"[!] Error loading pickle models: {e}. Falling back to Rule-based NLP.")
else:
    print("[!] AI models not found. Run model/train_model.py to train. Running in Rule-based NLP mode.")

# Static keywords for category and priority backup rules
CATEGORY_KEYWORDS = {
    'Electricity': ['electricity', 'fan', 'light', 'bulb', 'socket', 'plug', 'switch', 'power', 'fuse', 'wire', 'geyser', 'shock', 'spark', 'transformer', 'tripped', 'short circuit'],
    'Water': ['water', 'leak', 'leakage', 'tap', 'washroom', 'toilet', 'flush', 'basin', 'overflow', 'plumber', 'sewage', 'pipe', 'geyser', 'supply', 'hot water'],
    'WiFi': ['wifi', 'internet', 'network', 'router', 'connection', 'disconnected', 'speed', 'slow', 'signal', 'login', 'portal', 'ethernet'],
    'Cleanliness': ['clean', 'dirty', 'sweep', 'dust', 'cleaning', 'trash', 'garbage', 'smell', 'odor', 'insect', 'cockroach', 'mosquito', 'bug', 'washroom', 'waste'],
    'Mess': ['food', 'mess', 'dinner', 'lunch', 'breakfast', 'meal', 'catering', 'insect in food', 'water filter', 'taste', 'kitchen'],
    'Furniture': ['chair', 'table', 'bed', 'cupboard', 'desk', 'hinges', 'wardrobe', 'curtain', 'broken chair', 'wood', 'furniture'],
    'Security': ['security', 'theft', 'guard', 'gate', 'lock', 'stray', 'dog', 'stranger', 'outsider', 'fire', 'smoke', 'cctv', 'camera', 'intruder', 'alarm']
}

def analyze_complaint_nlp(text):
    """
    Combines Naive Bayes classification with domain-specific keyword scoring.
    """
    text_lower = text.lower()
    
    # 1. Predict Category
    predicted_category = "Others"
    if category_classifier and category_vectorizer:
        try:
            vec = category_vectorizer.transform([text])
            predicted_category = category_classifier.predict(vec)[0]
        except Exception:
            predicted_category = "Others"
            
    # Fallback/validation if category is Others or if model is not loaded
    if predicted_category == "Others" or not category_classifier:
        best_score = 0
        for category, keywords in CATEGORY_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > best_score:
                best_score = score
                predicted_category = category

    # 2. Predict Priority & Score
    predicted_priority = "Green"
    
    # Machine Learning predict
    if priority_classifier and priority_vectorizer:
        try:
            vec = priority_vectorizer.transform([text])
            predicted_priority = priority_classifier.predict(vec)[0]
        except Exception:
            predicted_priority = "Green"
            
    # Standard rule validation for high-security, high-risk items (Hard overrides)
    red_override_keywords = [
        'fire', 'short circuit', 'spark', 'electric shock', 'intruder', 
        'stranger in hostel', 'stray dog inside', 'water supply completely stopped', 
        'no electricity', 'transformer exploded', 'theft', 'smoke detector ringing'
    ]
    orange_override_keywords = [
        'leakage', 'wifi not working', 'bathroom overflow', 'internet down',
        'no hot water', 'dirty washroom', 'slow speed'
    ]
    
    if any(keyword in text_lower for keyword in red_override_keywords):
        predicted_priority = "Red"
    elif predicted_priority == "Green" and any(keyword in text_lower for keyword in orange_override_keywords):
        predicted_priority = "Orange"
        
    # Map to score
    if predicted_priority == "Red":
        priority_score = 3
    elif predicted_priority == "Orange":
        priority_score = 2
    else:
        priority_score = 1
        
    return predicted_category, predicted_priority, priority_score

# ----------------------------------------
# Auth Middlewares
# ----------------------------------------
def is_logged_in():
    return 'user_id' in session

def is_admin():
    return session.get('role') == 'admin'

# ----------------------------------------
# Application Routes
# ----------------------------------------

@app.route('/')
def index():
    if is_logged_in():
        if is_admin():
            return redirect(url_for('admin_dashboard'))
        return redirect(url_for('student_dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if is_logged_in():
        return redirect(url_for('index'))
        
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        
        user = None
        if mongo_active:
            user = users_col.find_one({'email': email})
        else:
            user = next((u for u in mock_users if u['email'] == email), None)
            
        if user and user['password'] == password:
            session['user_id'] = str(user.get('_id', user.get('user_id', ''))) if mongo_active else user['user_id']
            session['name'] = user['name']
            session['email'] = user['email']
            session['role'] = user['role']
            session['room_no'] = user.get('room_no', 'N/A')
            flash(f"Welcome back, {user['name']}!", 'success')
            return redirect(url_for('index'))
        else:
            flash("Invalid email or password.", 'danger')
            
    return render_template('login.html', mongo_status=mongo_active)

@app.route('/register', methods=['GET', 'POST'])
def register():
    if is_logged_in():
        return redirect(url_for('index'))
        
    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip()
        room_no = request.form.get('room_no', '').strip()
        password = request.form.get('password', '')
        role = request.form.get('role', 'student') # Default to student
        
        # Check if email already exists
        existing_user = None
        if mongo_active:
            existing_user = users_col.find_one({'email': email})
        else:
            existing_user = next((u for u in mock_users if u['email'] == email), None)
            
        if existing_user:
            flash("An account with this email already exists.", 'danger')
        else:
            user_data = {
                'name': name,
                'email': email,
                'room_no': room_no,
                'password': password,
                'role': role
            }
            
            if mongo_active:
                users_col.insert_one(user_data)
            else:
                user_data['user_id'] = str(uuid.uuid4())
                mock_users.append(user_data)
                
            flash("Registration successful! You can now log in.", 'success')
            return redirect(url_for('login'))
            
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    flash("Successfully logged out.", "info")
    return redirect(url_for('login'))

# ----------------------------------------
# Student Module
# ----------------------------------------

@app.route('/student/dashboard')
def student_dashboard():
    if not is_logged_in() or is_admin():
        return redirect(url_for('login'))
        
    user_id = session['user_id']
    
    # Get user complaints
    my_complaints = []
    if mongo_active:
        my_complaints = list(complaints_col.find({'user_id': user_id}).sort('created_at', -1))
    else:
        my_complaints = [c for c in mock_complaints if c['user_id'] == user_id]
        my_complaints.sort(key=lambda x: x['created_at'], reverse=True)
        
    # Get stats
    total = len(my_complaints)
    pending = sum(1 for c in my_complaints if c['status'] == 'Pending')
    in_progress = sum(1 for c in my_complaints if c['status'] == 'In Progress')
    resolved = sum(1 for c in my_complaints if c['status'] == 'Resolved')
    
    return render_template(
        'dashboard.html', 
        complaints=my_complaints[:5], # show last 5
        total=total, 
        pending=pending, 
        in_progress=in_progress,
        resolved=resolved
    )

@app.route('/student/submit-complaint', methods=['GET', 'POST'])
def submit_complaint():
    if not is_logged_in() or is_admin():
        return redirect(url_for('login'))
        
    if request.method == 'POST':
        complaint_text = request.form.get('complaint_text', '').strip()
        
        if not complaint_text:
            flash("Complaint description cannot be empty.", 'danger')
            return render_template('complaint_form.html')
            
        # Run AI Classification & Priority Engine
        category, priority, priority_score = analyze_complaint_nlp(complaint_text)
        
        complaint_data = {
            'complaint_id': str(uuid.uuid4())[:8],
            'user_id': session['user_id'],
            'student_name': session['name'],
            'room_no': session['room_no'],
            'complaint_text': complaint_text,
            'category': category,
            'priority': priority,
            'priority_score': priority_score,
            'status': 'Pending',
            'created_at': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'updated_at': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        if mongo_active:
            complaints_col.insert_one(complaint_data)
        else:
            mock_complaints.append(complaint_data)
            
        flash(f"Complaint submitted! AI classified this under '{category}' with {priority} priority.", 'success')
        return redirect(url_for('complaint_history'))
        
    return render_template('complaint_form.html')

@app.route('/student/complaint-history')
def complaint_history():
    if not is_logged_in() or is_admin():
        return redirect(url_for('login'))
        
    user_id = session['user_id']
    my_complaints = []
    
    if mongo_active:
        my_complaints = list(complaints_col.find({'user_id': user_id}).sort('created_at', -1))
    else:
        my_complaints = [c for c in mock_complaints if c['user_id'] == user_id]
        my_complaints.sort(key=lambda x: x['created_at'], reverse=True)
        
    return render_template('complaint_history.html', complaints=my_complaints)

# ----------------------------------------
# Admin Module
# ----------------------------------------

@app.route('/admin/dashboard')
def admin_dashboard():
    if not is_logged_in() or not is_admin():
        return redirect(url_for('login'))
        
    # Get filters
    search_query = request.args.get('search', '').strip()
    filter_priority = request.args.get('priority', '').strip()
    filter_status = request.args.get('status', '').strip()
    
    # Fetch complaints
    all_complaints = []
    if mongo_active:
        query = {}
        if search_query:
            query['$or'] = [
                {'complaint_text': {'$regex': search_query, '$options': 'i'}},
                {'complaint_id': {'$regex': search_query, '$options': 'i'}},
                {'student_name': {'$regex': search_query, '$options': 'i'}}
            ]
        if filter_priority:
            query['priority'] = filter_priority
        if filter_status:
            query['status'] = filter_status
            
        # Priority Based Resolution sorting: sort by priority_score descending (Red -> Orange -> Green), then by created_at descending
        all_complaints = list(complaints_col.find(query).sort([('priority_score', -1), ('created_at', -1)]))
    else:
        all_complaints = mock_complaints.copy()
        
        # Apply local mock filtering
        if search_query:
            all_complaints = [c for c in all_complaints if 
                              search_query.lower() in c['complaint_text'].lower() or 
                              search_query.lower() in c['complaint_id'].lower() or 
                              search_query.lower() in c['student_name'].lower()]
        if filter_priority:
            all_complaints = [c for c in all_complaints if c['priority'] == filter_priority]
        if filter_status:
            all_complaints = [c for c in all_complaints if c['status'] == filter_status]
            
        # Sort using priority_score (Descending) then date (Descending)
        all_complaints.sort(key=lambda x: (-x['priority_score'], x['created_at']), reverse=False)

    # Calculate overall analytics
    total_db = []
    if mongo_active:
        total_db = list(complaints_col.find({}))
    else:
        total_db = mock_complaints
        
    analytics = {
        'total': len(total_db),
        'pending': sum(1 for c in total_db if c['status'] == 'Pending'),
        'in_progress': sum(1 for c in total_db if c['status'] == 'In Progress'),
        'resolved': sum(1 for c in total_db if c['status'] == 'Resolved'),
        'red': sum(1 for c in total_db if c['priority'] == 'Red'),
        'orange': sum(1 for c in total_db if c['priority'] == 'Orange'),
        'green': sum(1 for c in total_db if c['priority'] == 'Green')
    }
    
    return render_template(
        'admin_dashboard.html',
        complaints=all_complaints,
        analytics=analytics,
        search=search_query,
        p_filter=filter_priority,
        s_filter=filter_status
    )

@app.route('/admin/update-status/<complaint_id>', methods=['POST'])
def update_status(complaint_id):
    if not is_logged_in() or not is_admin():
        return jsonify({'error': 'Unauthorized'}), 401
        
    new_status = request.form.get('status')
    if new_status not in ['Pending', 'In Progress', 'Resolved']:
        flash("Invalid status selected.", 'danger')
        return redirect(url_for('admin_dashboard'))
        
    current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if mongo_active:
        result = complaints_col.update_one(
            {'complaint_id': complaint_id},
            {'$set': {'status': new_status, 'updated_at': current_time}}
        )
        if result.matched_count > 0:
            flash(f"Complaint {complaint_id} status updated to '{new_status}'.", 'success')
        else:
            flash("Complaint not found.", 'danger')
    else:
        complaint = next((c for c in mock_complaints if c['complaint_id'] == complaint_id), None)
        if complaint:
            complaint['status'] = new_status
            complaint['updated_at'] = current_time
            flash(f"Complaint {complaint_id} status updated to '{new_status}'.", 'success')
        else:
            flash("Complaint not found.", 'danger')
            
    return redirect(url_for('admin_dashboard'))

# ----------------------------------------
# Initialize Demo Data for MongoDB if Empty
# ----------------------------------------
def seed_database_if_empty():
    if not mongo_active:
        # Seed Mock List
        if not mock_users:
            mock_users.append({
                'user_id': 'admin123',
                'name': 'Chief Warden (Admin)',
                'email': 'admin@hostel.com',
                'password': 'admin',
                'role': 'admin',
                'room_no': 'Office'
            })
            mock_users.append({
                'user_id': 'student123',
                'name': 'Rahul Sharma',
                'email': 'rahul@student.com',
                'password': 'student',
                'role': 'student',
                'room_no': 'A-304'
            })
        if not mock_complaints:
            mock_complaints.append({
                'complaint_id': 'E-101',
                'user_id': 'student123',
                'student_name': 'Rahul Sharma',
                'room_no': 'A-304',
                'complaint_text': 'There is a total blackout in our room. None of the fan or lights are working.',
                'category': 'Electricity',
                'priority': 'Red',
                'priority_score': 3,
                'status': 'Pending',
                'created_at': (datetime.datetime.now() - datetime.timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
                'updated_at': (datetime.datetime.now() - datetime.timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S")
            })
            mock_complaints.append({
                'complaint_id': 'W-102',
                'user_id': 'student123',
                'student_name': 'Suresh Kumar',
                'room_no': 'B-112',
                'complaint_text': 'Continuous water leakage from washroom pipe which overflows into corridor.',
                'category': 'Water',
                'priority': 'Orange',
                'priority_score': 2,
                'status': 'In Progress',
                'created_at': (datetime.datetime.now() - datetime.timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S"),
                'updated_at': datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            })
            mock_complaints.append({
                'complaint_id': 'F-103',
                'user_id': 'student123',
                'student_name': 'Aman Verma',
                'room_no': 'C-215',
                'complaint_text': 'The study table wood is peeling off from the corners.',
                'category': 'Furniture',
                'priority': 'Green',
                'priority_score': 1,
                'status': 'Resolved',
                'created_at': (datetime.datetime.now() - datetime.timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S"),
                'updated_at': (datetime.datetime.now() - datetime.timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S")
            })
        return

    # Seed Actual MongoDB
    if users_col.count_documents({}) == 0:
        print("[*] Seeding empty database with default users...")
        users_col.insert_many([
            {
                'name': 'Chief Warden (Admin)',
                'email': 'admin@hostel.com',
                'password': 'admin',
                'role': 'admin',
                'room_no': 'Office'
            },
            {
                'name': 'Rahul Sharma',
                'email': 'rahul@student.com',
                'password': 'student',
                'role': 'student',
                'room_no': 'A-304'
            }
        ])
        print("[+] Users collection seeded. Admin: admin@hostel.com (password: admin)")
        
    if complaints_col.count_documents({}) == 0:
        print("[*] Seeding empty database with sample complaints...")
        student = users_col.find_one({'role': 'student'})
        student_id = str(student['_id']) if student else 'student123'
        
        complaints_col.insert_many([
            {
                'complaint_id': 'E-204',
                'user_id': student_id,
                'student_name': 'Rahul Sharma',
                'room_no': 'A-304',
                'complaint_text': 'Our water geyser is sparking when switched on. Please repair immediately as it is highly dangerous!',
                'category': 'Electricity',
                'priority': 'Red',
                'priority_score': 3,
                'status': 'Pending',
                'created_at': (datetime.datetime.now() - datetime.timedelta(minutes=45)).strftime("%Y-%m-%d %H:%M:%S"),
                'updated_at': (datetime.datetime.now() - datetime.timedelta(minutes=45)).strftime("%Y-%m-%d %H:%M:%S")
            },
            {
                'complaint_id': 'N-205',
                'user_id': student_id,
                'student_name': 'Amit Patel',
                'room_no': 'D-402',
                'complaint_text': 'Hostel WiFi speed is less than 100kbps, cannot join college online lectures.',
                'category': 'WiFi',
                'priority': 'Orange',
                'priority_score': 2,
                'status': 'Pending',
                'created_at': (datetime.datetime.now() - datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S"),
                'updated_at': (datetime.datetime.now() - datetime.timedelta(hours=3)).strftime("%Y-%m-%d %H:%M:%S")
            },
            {
                'complaint_id': 'F-206',
                'user_id': student_id,
                'student_name': 'Vikas Roy',
                'room_no': 'C-108',
                'complaint_text': 'The chair in room has a slightly unstable leg. Requesting repair.',
                'category': 'Furniture',
                'priority': 'Green',
                'priority_score': 1,
                'status': 'Resolved',
                'created_at': (datetime.datetime.now() - datetime.timedelta(days=4)).strftime("%Y-%m-%d %H:%M:%S"),
                'updated_at': (datetime.datetime.now() - datetime.timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")
            }
        ])
        print("[+] Complaints collection seeded with default items.")

# Seed database on start
seed_database_if_empty()

if __name__ == '__main__':
    # Run server on port 5000 for localhost testing
    app.run(host='0.0.0.0', port=5000, debug=True)
