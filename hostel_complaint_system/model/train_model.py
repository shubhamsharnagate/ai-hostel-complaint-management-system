"""
Hostel Complaint Management System - AI Model Training Script
Author: Final Year B.Tech CSE Student
Description: This script loads a dataset of hostel complaints, processes the text
using TF-IDF (Term Frequency-Inverse Document Frequency), and trains a Naive Bayes
classifier to automatically predict the category and priority of a complaint.
The trained models are saved as pickle files for prediction in the Flask backend.
"""

import os
import pandas as pd
import numpy as np
import pickle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline

def train_and_save_models():
    # Define file paths
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dataset_path = os.path.join(base_dir, 'dataset', 'hostel_complaints.csv')
    model_dir = os.path.join(base_dir, 'model')
    
    # Create model directory if it doesn't exist
    if not os.path.exists(model_dir):
        os.makedirs(model_dir)
        
    print(f"[*] Loading training dataset from: {dataset_path}")
    if not os.path.exists(dataset_path):
        print(f"[!] Error: Dataset file not found at {dataset_path}")
        return False
        
    df = pd.read_csv(dataset_path)
    print(f"[*] Dataset loaded successfully with {len(df)} samples.")
    
    # Fill any null values
    df['complaint_text'] = df['complaint_text'].fillna('')
    df['category'] = df['category'].fillna('Others')
    df['priority'] = df['priority'].fillna('Green')
    
    # 1. Train Category Classifier
    print("\n[*] Training Category Classification Model...")
    category_vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words='english', min_df=1)
    category_classifier = MultinomialNB(alpha=0.1)
    
    X_cat = category_vectorizer.fit_transform(df['complaint_text'])
    y_cat = df['category']
    category_classifier.fit(X_cat, y_cat)
    print("[+] Category model trained.")
    
    # 2. Train Priority Classifier
    print("[*] Training Priority Classification Model...")
    priority_vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words='english', min_df=1)
    priority_classifier = MultinomialNB(alpha=0.1)
    
    X_pri = priority_vectorizer.fit_transform(df['complaint_text'])
    y_pri = df['priority']
    priority_classifier.fit(X_pri, y_pri)
    print("[+] Priority model trained.")
    
    # Save the models
    cat_model_path = os.path.join(model_dir, 'category_model.pkl')
    cat_vec_path = os.path.join(model_dir, 'category_vectorizer.pkl')
    pri_model_path = os.path.join(model_dir, 'priority_model.pkl')
    pri_vec_path = os.path.join(model_dir, 'priority_vectorizer.pkl')
    
    with open(cat_model_path, 'wb') as f:
        pickle.dump(category_classifier, f)
    with open(cat_vec_path, 'wb') as f:
        pickle.dump(category_vectorizer, f)
        
    with open(pri_model_path, 'wb') as f:
        pickle.dump(priority_classifier, f)
    with open(pri_vec_path, 'wb') as f:
        pickle.dump(priority_vectorizer, f)
        
    print("\n[+] Success! All models and vectorizers have been saved to the 'model/' directory:")
    print(f"  - Category Classifier: {cat_model_path}")
    print(f"  - Category Vectorizer: {cat_vec_path}")
    print(f"  - Priority Classifier: {pri_model_path}")
    print(f"  - Priority Vectorizer: {pri_vec_path}")
    
    return True

if __name__ == "__main__":
    train_and_save_models()
