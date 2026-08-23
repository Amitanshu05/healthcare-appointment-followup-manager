import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load environment variables from the local .env file
env = {}
if os.path.exists('.env'):
    with open('.env') as f:
        for line in f:
            if line.strip() and not line.startswith('#'):
                try:
                    key, val = line.strip().split('=', 1)
                    env[key.strip()] = val.strip()
                except ValueError:
                    pass

smtp_username = env.get('SMTP_USERNAME', '')
smtp_password = env.get('SMTP_PASSWORD', '')

if not smtp_username or not smtp_password:
    print("Error: SMTP_USERNAME or SMTP_PASSWORD not found in your .env file!")
    exit(1)

print(f"Connecting to Gmail SMTP server using {smtp_username}...")
try:
    # 1. Connect to standard Gmail SMTP port
    server = smtplib.SMTP('smtp.gmail.com', 587)
    server.starttls()  # Upgrade connection to secure SSL/TLS
    
    # 2. Login to the mail server using App Password
    server.login(smtp_username, smtp_password)
    
    # 3. Create MIME Email template
    msg = MIMEMultipart()
    msg['From'] = smtp_username
    msg['To'] = smtp_username
    msg['Subject'] = 'CareSync Hospital - SMTP Connection Test Successful!'
    
    body = (
        "Hello!\n\n"
        "Your SMTP email server integration is working perfectly on your MacBook!\n"
        "All system registration and clinical booking alerts are ready to dispatch successfully.\n\n"
        "Best regards,\n"
        "CareSync Hospital Manager Bot"
    )
    msg.attach(MIMEText(body, 'plain'))
    
    # 4. Dispatch email to self
    server.sendmail(smtp_username, smtp_username, msg.as_string())
    server.quit()
    print("==================================================")
    print("SUCCESS! Test email sent successfully to your inbox!")
    print("Please check your email address:", smtp_username)
    print("==================================================")
except Exception as e:
    print("==================================================")
    print(f"FAILED to send email. Error detail: {e}")
    print("Please double check if your App Password in .env is correct.")
    print("==================================================")
