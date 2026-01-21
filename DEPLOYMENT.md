# MindfulMe - Production Deployment Guide

## 🚀 Pre-Deployment Checklist

### 1. Security Configuration

- [ ] **MongoDB Security**
  ```bash
  # Enable authentication
  mongo admin
  db.createUser({
    user: "mindfulme_admin",
    pwd: "STRONG_PASSWORD_HERE",
    roles: ["readWrite", "dbAdmin"]
  })
  ```
  
- [ ] **Update MongoDB URL** in backend/.env:
  ```
  MONGO_URL=mongodb://mindfulme_admin:PASSWORD@mongodb:27017/mindfulme?authSource=admin
  ```

- [ ] **Generate secure API keys**
  ```bash
  # For production, use dedicated OpenRouter API key
  # Never commit actual keys to Git
  ```

- [ ] **Configure CORS properly** in `server.py`:
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["https://yourdomain.com"],  # Specify exact domain
      allow_credentials=True,
      allow_methods=["GET", "POST", "PUT", "DELETE"],
      allow_headers=["*"],
  )
  ```

- [ ] **Enable HTTPS/SSL**
  - Use Let's Encrypt for free SSL certificates
  - Configure reverse proxy (Nginx) with SSL

### 2. Environment Variables

Create production `.env` files:

**backend/.env:**
```bash
MONGO_URL=mongodb://user:pass@mongodb:27017/mindfulme?authSource=admin
DB_NAME=mindfulme
OPENROUTER_API_KEY=sk-or-PRODUCTION-KEY-HERE
ENVIRONMENT=production
```

**frontend/.env:**
```bash
EXPO_PUBLIC_BACKEND_URL=https://api.yourdomain.com
ENVIRONMENT=production
```

### 3. Performance Optimization

- [ ] **MongoDB Indexes** (already created via script):
  ```python
  # Run /tmp/create_indexes.py
  ```

- [ ] **Enable MongoDB Replication** for high availability
- [ ] **Set up Redis caching** (optional but recommended)
- [ ] **Configure rate limiting** on API endpoints

### 4. Monitoring & Logging

- [ ] Set up **Sentry** for error tracking:
  ```bash
  pip install sentry-sdk
  ```

- [ ] Configure **application logging**:
  ```python
  import logging
  logging.basicConfig(
      level=logging.INFO,
      format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
      handlers=[
          logging.FileHandler('app.log'),
          logging.StreamHandler()
      ]
  )
  ```

- [ ] Set up **health check endpoints**
- [ ] Configure **uptime monitoring** (UptimeRobot, Pingdom)

### 5. Backup Strategy

- [ ] **Automated MongoDB backups**:
  ```bash
  # Daily backup cron job
  0 2 * * * mongodump --uri="mongodb://user:pass@localhost:27017/mindfulme" --out=/backups/$(date +\%Y\%m\%d)
  ```

- [ ] **Backup retention policy** (keep 30 days)
- [ ] **Test restore procedures**

---

## 🐳 Docker Deployment

### Option 1: Docker Compose (Recommended for Small-Medium Scale)

1. **Build images:**
   ```bash
   docker-compose build
   ```

2. **Start services:**
   ```bash
   docker-compose up -d
   ```

3. **Verify:**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

4. **Health check:**
   ```bash
   curl https://api.yourdomain.com/api/
   ```

### Option 2: Kubernetes (Recommended for Large Scale)

Create Kubernetes manifests:

**deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mindfulme-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mindfulme-backend
  template:
    metadata:
      labels:
        app: mindfulme-backend
    spec:
      containers:
      - name: backend
        image: yourusername/mindfulme-backend:latest
        ports:
        - containerPort: 8001
        env:
        - name: MONGO_URL
          valueFrom:
            secretKeyRef:
              name: mindfulme-secrets
              key: mongo-url
        - name: OPENROUTER_API_KEY
          valueFrom:
            secretKeyRef:
              name: mindfulme-secrets
              key: llm-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

**service.yaml:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: mindfulme-backend
spec:
  selector:
    app: mindfulme-backend
  ports:
  - protocol: TCP
    port: 8001
    targetPort: 8001
  type: LoadBalancer
```

---

## ☁️ Cloud Deployment Options

### AWS Deployment

1. **ECS (Elastic Container Service)**:
   - Push Docker images to ECR
   - Create ECS task definitions
   - Configure Application Load Balancer
   - Set up Auto Scaling

2. **EC2 with Docker**:
   ```bash
   # Install Docker
   sudo yum update -y
   sudo yum install docker -y
   sudo service docker start
   
   # Pull and run
   docker pull yourusername/mindfulme-backend
   docker run -d -p 8001:8001 --env-file .env mindfulme-backend
   ```

### Google Cloud Platform

1. **Cloud Run** (Serverless):
   ```bash
   gcloud run deploy mindfulme-backend \
     --image gcr.io/PROJECT/mindfulme-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated
   ```

2. **GKE (Kubernetes Engine)**:
   ```bash
   gcloud container clusters create mindfulme-cluster
   kubectl apply -f k8s/
   ```

### Azure

1. **Azure Container Instances**:
   ```bash
   az container create \
     --resource-group mindfulme \
     --name mindfulme-backend \
     --image yourusername/mindfulme-backend \
     --cpu 2 --memory 4 \
     --ports 8001
   ```

### DigitalOcean

1. **App Platform** (Easiest):
   - Connect GitHub repository
   - Configure environment variables
   - Deploy with one click

2. **Droplets with Docker**:
   ```bash
   # SSH to droplet
   apt-get update
   apt-get install docker.io docker-compose
   git clone your-repo
   docker-compose up -d
   ```

---

## 🔄 CI/CD Setup

### GitHub Actions (Included)

1. **Add GitHub Secrets**:
   - Go to Settings → Secrets and variables → Actions
   - Add:
     - `DOCKER_USERNAME`
     - `DOCKER_PASSWORD`
     - `OPENROUTER_API_KEY`
     - `SSH_PRIVATE_KEY` (for deployment)
     - `SERVER_HOST`

2. **Configure deployment step** in `.github/workflows/ci-cd.yml`:
   ```yaml
   - name: Deploy to production
     run: |
       echo "${{ secrets.SSH_PRIVATE_KEY }}" > key.pem
       chmod 600 key.pem
       ssh -i key.pem user@${{ secrets.SERVER_HOST }} '
         cd /app/mindfulme
         git pull
         docker-compose pull
         docker-compose up -d
       '
   ```

### GitLab CI (Alternative)

Create `.gitlab-ci.yml`:
```yaml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  script:
    - cd backend && pip install -r requirements.txt
    - pytest tests/

build:
  stage: build
  script:
    - docker build -t mindfulme-backend -f Dockerfile.backend .
    - docker push yourusername/mindfulme-backend

deploy:
  stage: deploy
  script:
    - ssh user@server 'cd /app && docker-compose up -d'
  only:
    - main
```

---

## 📊 Monitoring Setup

### Application Monitoring (Sentry)

```python
# In server.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn="YOUR_SENTRY_DSN",
    integrations=[FastApiIntegration()],
    traces_sample_rate=1.0,
)
```

### Database Monitoring

```bash
# MongoDB Cloud Manager or Ops Manager
# Or use mongotop for real-time stats
mongotop --host localhost:27017
```

### Infrastructure Monitoring

- **Prometheus + Grafana** for metrics
- **ELK Stack** for log aggregation
- **CloudWatch** (AWS) or **Stackdriver** (GCP)

---

## 🔒 Security Hardening

### 1. API Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@api_router.post("/conversations/message")
@limiter.limit("10/minute")
async def send_message(request: Request, data: MessageCreate):
    # ... existing code
```

### 2. Input Validation

```python
from pydantic import validator, Field

class MessageCreate(BaseModel):
    conversationId: str = Field(..., min_length=24, max_length=24)
    content: str = Field(..., min_length=1, max_length=5000)
    
    @validator('content')
    def sanitize_content(cls, v):
        return v.strip()
```

### 3. Database Security

```javascript
// Enable MongoDB authentication
use admin
db.createUser({
  user: "admin",
  pwd: "STRONG_PASSWORD",
  roles: ["root"]
})

// Restart MongoDB with auth
mongod --auth --bind_ip localhost
```

### 4. Firewall Configuration

```bash
# UFW (Ubuntu)
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 443/tcp # HTTPS
sudo ufw allow 80/tcp  # HTTP (redirect to HTTPS)
sudo ufw deny 27017    # MongoDB (internal only)
sudo ufw deny 8001     # Backend (behind reverse proxy)
sudo ufw enable
```

---

## 📈 Scaling Strategy

### Horizontal Scaling

1. **Backend**: Multiple FastAPI instances behind load balancer
2. **MongoDB**: Replica set with 3+ nodes
3. **CDN**: CloudFlare or AWS CloudFront for static assets

### Vertical Scaling

- Start: 2 CPU, 4GB RAM
- Medium: 4 CPU, 8GB RAM
- Large: 8 CPU, 16GB RAM

### Caching Strategy

```python
# Redis for session storage and API caching
import redis
redis_client = redis.Redis(host='localhost', port=6379, db=0)

# Cache knowledge graph queries
@app.get("/knowledge/nodes")
async def get_nodes():
    cached = redis_client.get("knowledge_nodes")
    if cached:
        return json.loads(cached)
    
    # ... fetch from MongoDB
    redis_client.setex("knowledge_nodes", 300, json.dumps(nodes))
    return nodes
```

---

## 🧪 Pre-Launch Testing

### Load Testing

```bash
# Using Apache Bench
ab -n 1000 -c 10 https://api.yourdomain.com/api/

# Using locust
pip install locust
locust -f load_test.py --host https://api.yourdomain.com
```

### Security Testing

```bash
# OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py -t https://yourdomain.com

# SSL Check
ssllabs.com/ssltest/
```

### Functional Testing

- [ ] Test all API endpoints
- [ ] Test knowledge graph extraction
- [ ] Test with real AI conversations
- [ ] Test image upload limits
- [ ] Test voice recording
- [ ] Test on multiple devices

---

## 📞 Post-Deployment

### 1. Launch Checklist

- [ ] DNS configured and propagated
- [ ] SSL certificate valid
- [ ] All services running
- [ ] Backups automated
- [ ] Monitoring active
- [ ] Error tracking configured
- [ ] Documentation updated

### 2. Communication

- [ ] Announce launch
- [ ] Share app store links
- [ ] Update social media
- [ ] Email beta users

### 3. Monitoring First 24 Hours

- [ ] Watch error rates
- [ ] Monitor API response times
- [ ] Check database performance
- [ ] Track user signups
- [ ] Review logs for issues

---

## 🆘 Troubleshooting

### Common Issues

**Backend not starting:**
```bash
# Check logs
docker-compose logs backend

# Common fix: MongoDB connection
# Ensure MONGO_URL is correct
```

**Frontend build errors:**
```bash
# Clear cache
cd frontend
rm -rf node_modules .expo
yarn install
expo start --clear
```

**Knowledge graph not extracting:**
```bash
# Check MongoDB indexes
mongo mindfulme
db.knowledge_nodes.getIndexes()

# Re-run index creation
python /tmp/create_indexes.py
```

---

## 📚 Resources

- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [Expo Deployment](https://docs.expo.dev/distribution/introduction/)
- [MongoDB Production Notes](https://docs.mongodb.com/manual/administration/production-notes/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)

---

**Ready to launch! 🚀**
