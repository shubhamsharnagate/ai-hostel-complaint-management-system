# AI-Based Hostel Complaint Management System
An advanced, intelligent full-stack web application designed for engineering college hostels. Automatically categorizes complaints and calculates high-fidelity resolution priority queues using a custom Natural Language Processing (NLP) pipeline powered by Scikit-Learn (TF-IDF Vectorization and Naive Bayes Classifiers).

---

## 🚀 Key Features

### 1. Student Module
- **Secure Registration & Login:** Create an account bound to institutional email and room numbers.
- **Interactive Complaint Lodging:** Describe issues in simple English.
- **Dynamic Live AI Preview:** Watch the built-in AI classify and assign priority in real-time as you type!
- **Historical Logs & Tracking:** Track status progression (**Pending &rarr; In Progress &rarr; Resolved**) of all previous filings.

### 2. Admin (Warden) Module
- **Consolidated Analytics:** Visual dashboards tracking Total Complaints, Red/Orange/Green priority counts, and Pending workloads.
- **Smart Queue Dispatching:** High-priority items (Red) automatically jump to the top of the queue using a calculated `priority_score`.
- **Advanced Query Filters:** Instant search by Student Name, ID, or description text, paired with multi-select status and priority filtering.
- **Dynamic Status Progression:** Live state transition controllers for dispatching maintenance updates.

### 3. AI NLP Engine (Scikit-Learn)
- **Automatic Category Extraction:** Maps plain text descriptions into one of eight categories: *Electricity, Water, WiFi, Cleanliness, Mess, Furniture, Security, or Others*.
- **Priority Assessment Engine:** Analyzes severity metrics of descriptions, classifying them into standard bands:
  - 🔴 **Red (High Priority):** Emergency breakdowns (e.g., *short circuits, fire risks, complete water supply outage, intruders*). Maps to `priority_score: 3`.
  - 🟠 **Orange (Medium Priority):** Disruptive maintenance (e.g., *router offline, water tap leakage, bathroom clogs*). Maps to `priority_score: 2`.
  - 🟢 **Green (Low Priority):** Minor repairs (e.g., *broken chairs, loose cupboard handles, noisy fans*). Maps to `priority_score: 1`.

---

## 📂 Project Directory Structure

```text
hostel_complaint_system/
│
├── app.py                      # Flask Server and Routing Controller
├── config.py                   # MongoDB and Secret Configs
├── requirements.txt            # Python Dependencies
├── README.md                   # Setup Guide and Project Documentation
│
├── dataset/
│   └── hostel_complaints.csv   # Structured sample dataset for AI training
│
├── model/
│   ├── train_model.py          # TF-IDF Vectorizer & Naive Bayes training script
│   ├── category_model.pkl      # Saved pickle Category classifier
│   ├── category_vectorizer.pkl # Saved pickle Category TF-IDF vectorizer
│   ├── priority_model.pkl      # Saved pickle Priority classifier
│   └── priority_vectorizer.pkl # Saved pickle Priority TF-IDF vectorizer
│
├── static/
│   ├── css/
│   │   └── style.css           # Custom bespoke design system (No Bootstrap!)
│   ├── js/
│   │   └── main.js             # Live AI prediction preview and interactive animations
│   └── images/                 # Static graphical assets (if any)
│
└── templates/
    ├── login.html              # Secure entry form (Default Student/Admin logins)
    ├── register.html           # institutional student registration form
    ├── dashboard.html          # Student statistics and quick actions dashboard
    ├── complaint_form.html     # Intelligent complaint form with Live AI previews
    ├── complaint_history.html  # Student history tracking log
    └── admin_dashboard.html    # Warden overview with status updates and AI sorted queue
```

---

## 🛠️ Step-by-Step Installation & Local Setup

### Prerequisite 1: Install MongoDB
Download and install MongoDB Community Server on your local machine:
1. **Windows:** Download the installer from the [Official MongoDB Page](https://www.mongodb.com/try/download/community), follow the setup wizard, and install **MongoDB Compass** (a visual database interface).
2. **macOS (via Homebrew):**
   ```bash
   brew tap mongodb/brew
   brew install mongodb-community@7.0
   brew services start mongodb-community
   ```
3. Confirm MongoDB is active by opening **MongoDB Compass** and hitting **Connect** with connection string: `mongodb://localhost:27017/`.

### Prerequisite 2: Python Setup
Ensure you have Python 3.8+ installed on your computer.

---

### Step 1: Create a Virtual Environment
Navigate to the extracted `hostel_complaint_system` directory in your terminal and create a virtual environment to manage dependencies:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 2: Install Required Dependencies
Run the package installation command:
```bash
pip install -r requirements.txt
```

### Step 3: Run the AI Model Training Script
Before booting up the server, you need to compile the training dataset and save the vectorizers and models. Execute the training script:
```bash
python model/train_model.py
```
*You will see diagnostic logs showing that the TF-IDF Vectorizers and Naive Bayes Classifiers have been successfully serialized inside the `model/` folder.*

### Step 4: Boot up the Flask Application
Run the core development server:
```bash
python app.py
```
*The Flask server is now live at `http://127.0.0.1:5000/`.*

---

## 👥 Default Demo Credentials (To Test App Immediately)

### 1. Student Access
- **Email:** `rahul@student.com`
- **Password:** `student`
- *Or register a new student account using the signup link.*

### 2. Admin (Warden) Access
- **Email:** `admin@hostel.com`
- **Password:** `admin`

---

## 🧠 Core AI NLP Math & Implementation Details
This project utilizes an **N-gram TF-IDF Vectorizer** (with standard English stop-words removed) to transform raw text sentences into sparse term frequency metrics. 

These vectors are classified using a **Multinomial Naive Bayes (MultinomialNB)** model, which calculates class probabilities using Bayes' Theorem:

$$P(C \mid X) = \frac{P(X \mid C) \cdot P(C)}{P(X)}$$

Where $C$ is the class (e.g., *Electricity* or *Red Priority*) and $X$ is the document term vector.

*Designed and prepared for B.Tech CSE Final Year Project Evaluation.*
