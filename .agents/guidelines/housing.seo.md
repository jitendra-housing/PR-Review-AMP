# housing.seo Repository Guidelines

Comprehensive coding guidelines and standards for the **housing.seo** repository (https://github.com/elarahq/housing.seo).

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Code Style & Formatting](#code-style--formatting)
4. [Architecture & Folder Structure](#architecture--folder-structure)
5. [Component Patterns](#component-patterns)
6. [State Management](#state-management)
7. [Error Handling & Logging](#error-handling--logging)
8. [Testing Requirements](#testing-requirements)
9. [Performance Guidelines](#performance-guidelines)
10. [Security Requirements](#security-requirements)
11. [Build & Deployment](#build--deployment)
12. [PR Review Checklist](#pr-review-checklist)
13. [Common Issues](#common-issues)

---

## Project Overview

The housing.seo service is a **Django-based SEO service** that generates HTML tags, meta information, and links for the Housing Main Website.

**Primary Functions:**
- Title, meta, and description generation
- Event schema and breadcrumb interlinking
- Sitemap submission to search engines
- Internal linking between pages

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Backend | Django 3.2 (Python) |
| Database | PostgreSQL (primary), MySQL (support) |
| Caching | Aerospike (distributed cache) |
| Message Queue | RabbitMQ |
| Task Queue | Celery |
| Search | MongoDB, BigQuery |
| Deployment | Docker + Nginx |
| Monitoring | New Relic APM |
| Logging | File-based (stdout in Docker) |

---

## Code Style & Formatting

### 🚨 IMPORTANT: No Linting Tools

This project does **NOT** use:
- ❌ `.eslintrc` or equivalent
- ❌ `.prettierrc` or equivalent  
- ❌ Black formatter
- ❌ Flake8 or similar
- ❌ Pre-commit hooks

**Code quality relies on manual PR review and following established patterns.**

### Naming Conventions

```python
# Classes: PascalCase
class FooterModel:
    pass

# Functions: snake_case
def get_polygon_data():
    pass

# Constants: UPPER_CASE
ALL_INDIA_POLYGON_ID = "f7f5d7f50dde9452144e"

# Private methods: _leading_underscore
def _prepare_meta_bin(self):
    pass

# Local variables: snake_case
polygon_uuid = "f7f5d7f50dde9452144e"
```

### Spacing & Indentation

```python
# Use 2-space indentation (project convention)
class ExampleClass:
  def __init__(self):
    self.value = None

# No strict line length (80-120+ chars accepted)
```

### Encoding Declaration

```python
# Always include for files with non-ASCII characters
# -*- coding: utf-8 -*-
```

### Import Order

```python
# 1. Django imports first
from django.views import debug
from django.core.exceptions import PermissionDenied
from django.http.response import HttpResponse

# 2. Standard library imports
import json
import traceback
import requests
from datetime import datetime

# 3. Third-party imports
import aerospike
import newrelic.agent

# 4. Local imports
from lib.process_logger import ProcessLogger
from footer_common.classes.seo_basic_meta import SeoBasicMeta
from footer_api.helpers import getcrumb
```

### Variable Naming

```python
# ✅ GOOD: Descriptive names
polygon_uuid = "f7f5d7f50dde9452144e"
aero_data = polygon.aero_data
is_active = status_id == Polygon.STATUSES['ACTIVE']
retry_count = 3

# ❌ BAD: Single letter variables (except loops)
p = Polygon(id)  # ❌
polygon = Polygon(id)  # ✅

# ❌ BAD: Ambiguous abbreviations
apt_id  # ❌ Unclear
apartment_type_id  # ✅ Clear

# ✅ Consistent project abbreviations
est = establishment
poly = polygon
aero = aerospike
```

---

## Architecture & Folder Structure

### Repository Structure

```
housing.seo/
├── footer_api/              # Main Django app
│   ├── settings.py         # Django configuration
│   ├── urls.py             # URL routing
│   ├── views.py            # Request handlers
│   ├── helpers.py          # Utility functions
│   ├── middleware.py       # Custom middleware
│   ├── constants.py        # Application constants
│   └── wsgi.py             # WSGI entry point
├── footer_common/          # Shared utilities
│   ├── classes/            # Base classes
│   │   ├── decorators.py
│   │   ├── seo_basic_meta.py
│   │   ├── footer_response.py
│   │   └── api_handler.py
│   └── helpers/            # Helper functions
├── lib/                    # Core utilities (reusable)
│   ├── logger.py
│   ├── process_logger.py
│   ├── singleton.py
│   ├── response_handler.py
│   ├── footer_model.py
│   └── aerospike_client.py
├── api/v1/                 # REST API endpoints
├── polygons/               # Polygon entity
├── flats/                  # Flat/apartment entity
├── builders/               # Builder entity
├── establishments/         # Establishment entity
├── new_projects/           # Projects entity
├── crons/                  # Scheduled tasks (Celery)
│   ├── management/commands/
│   │   └── run_cron.py
│   └── classes/
├── internal_linking/       # Link generation
├── config/                 # Configuration
├── tests/                  # Test files
├── conftest.py             # Pytest fixtures
├── pytest.ini              # Pytest config
├── requirements.txt        # Dependencies
├── Dockerfile              # Production image
├── Dockerfile_cron         # Cron image
└── nginx.conf              # Nginx config
```

### Entity-Based Module Pattern

Each entity follows consistent structure:

```python
# polygons/classes/polygon.py
class Polygon(FooterModel, TaxonomyHelper, PolygonHelper):
    db_name = settings.DATABASE_ALIASES['HR']
    table_name = 'polygons'
    aero_set_name = 'polygons'
    key_name = 'uuid'
    
    STATUSES = {
        'ACTIVE': 1,
        'INACTIVE': 2
    }
    
    def __init__(self, id, aero_fetch=True, bins=DEFAULT_BINS):
        pass
```

---

## Component Patterns

### Handler Classes

```python
# Pattern: *ResponseHandler, *Handler, *ApiHandler
class ApiHandler(object):
    def __init__(self, *args, **kwargs):
        if kwargs.get('api_url'):
            self.api_url = kwargs.get('api_url')
        self.api_data = {}
    
    def set_api_data(self, api_data={}):
        if api_data == {}:
            response = requests.get(self.api_url)
            self.api_data = json.loads(response.content)
            self.response_code = response.status_code
        else:
            self.api_data = api_data
            self.response_code = 200
        return self.api_data
    
    def get_api_data(self):
        if self.api_data == {}:
            self.set_api_data()
        return self.api_data
```

### Decorator Pattern

```python
from functools import wraps

def nginx_caching(orig_func):
    """Decorator to set caching headers for successful responses"""
    @wraps(orig_func)
    def wrapper(request, *args, **kwargs):
        response = orig_func(request, *args, **kwargs)
        try:
            content = json.loads(response.content)
            if content.get('error', {}).get('status_code', 200) != 200:
                return response
        except Exception as e:
            pass
        return addCustomHeader(response)
    return wrapper

# Usage
@nginx_caching
@redirect_to_new_canonicals
def apiV2(request, service, *args, **kwargs):
    pass
```

### Decorator Stacking Order (CRITICAL)

```python
# ✅ CORRECT ORDER - outermost to innermost
@nginx_caching                    # 1. Cache control (outermost)
@redirect_to_new_canonicals       # 2. URL redirection
@check_de_indexing                # 3. Content filtering
@polygon_page_handler             # 4. Entity processing
@change_4bhk_apartment_type_id    # 5. Parameter transformation
def apiV2(request, service):
    pass
```

### Middleware Pattern

```python
from django.utils.deprecation import MiddlewareMixin

class UUIDMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request.log_messages = []
        request.main_method = 'Undefined'
        request.start_time = datetime.datetime.now()
        request.uuid = uuid.uuid1()

class LoggerMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        request.status_code = response.status_code
        request.finish_time = datetime.datetime.now()
        ProcessLogger.output_logs()
        return response
```

### Singleton Pattern

```python
class Singleton(type):
    _instances = {}
    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            cls._instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)
        return cls._instances[cls]

class ProcessLogger(object, metaclass=Singleton):
    def __init__(self):
        self.logger_object = Logger()
```

---

## State Management

### Request State (ProcessLogger)

```python
from lib.process_logger import ProcessLogger

class ProcessLogger(object, metaclass=Singleton):
    @classmethod
    def info(cls, msg, ignore_request_check=False):
        if ignore_request_check:
            ProcessLogger.logger().info(msg)
        else:
            request = CrequestMiddleware.get_request()
            if request is not None:
                request_id = request.META.get('HTTP_X_REQUEST_ID', 'BE_REQUEST')
                formatted_msg = f"request_id= {request_id} msg = {msg}"
                request.log_messages.append(['info', formatted_msg])
            else:
                ProcessLogger.logger().info(msg)
```

### Aerospike Cache State

```python
class Polygon(FooterModel):
    aero_set_name = 'polygons'
    DEFAULT_BINS = [
        'breadcrumbs', 'topbuildermeta', 'meta', 'polyinx', 
        'collections', 'inventory', 'establishment', 'entity_links'
    ]
    
    def __init__(self, id, aero_fetch=True, bins=DEFAULT_BINS):
        self.id = id
        FooterModel.__init__(self, aero_fetch=aero_fetch, bins=bins)
```

### FooterModel (Base ORM)

```python
class FooterModel(FooterAeroHandler, FooterApiHandler):
    def __init__(self, aero_fetch=True, prefetch=[], bins=[]):
        self.db_data = DictInstance({})
        self.aero_data = DictInstance({})
        self.api_data = DictInstance({})
        FooterAeroHandler.__init__(self, prefetch=prefetch, bins=bins)
        try:
            if self.id not in [None, '', 'None'] and (aero_fetch or len(prefetch) != 0):
                self.aero_fetch()
        except Exception as ex:
            ProcessLogger.error(f"FooterModel init error for class = {self.__class__.__name__} - id = {self.id}")
```

---

## Error Handling & Logging

### Required Logging Pattern

```python
from lib.process_logger import ProcessLogger

# ✅ REQUIRED: Use ProcessLogger for all errors
try:
    data = fetch_data()
except Exception as e:
    ProcessLogger.error(f"Error in fetch_data: {traceback.format_exc()}")

# ✅ REQUIRED: Log with context
try:
    polygon = Polygon(poly_uuid)
except Exception as ex:
    ProcessLogger.error(f"FooterModel init error for class = {self.__class__.__name__} - id = {self.id}")

# ❌ DON'T: Use bare except or print
try:
    data = fetch_data()
except:  # ❌ Bad
    print("Error")  # ❌ Bad
```

### Response Structure Pattern

```python
# REQUIRED: All API responses follow this structure
{
    "status": "success" | "error",
    "error": {
        "status_code": 200 | 301 | 302 | 404 | 410 | 400 | 500,
        "message": "optional error message",
        "redirect_url": "for 301/302 responses"
    },
    "data": {...},
    "request_id": "uuid for tracing",
    "robots_info": {...}
}

# Use ResponseHandler for consistency
from lib.response_handler import ResponseHandler

handler = ResponseHandler()
response, status = handler.get_301_response(redirect_url='/new-url')
```

---

## Testing Requirements

### Configuration

```ini
# pytest.ini
[pytest]
DJANGO_SETTINGS_MODULE = footer_api.settings
env = DJANGO_TEST_ENV=true
```

### Pytest Fixtures

```python
# conftest.py - AUTO DISABLES SLACK
import pytest
from unittest.mock import patch

@pytest.fixture(autouse=True)
def disable_slack_notifications():
    """Automatically disable Slack notifications for all tests"""
    with patch('lib.slack_webhook_poster.SlackWebhookPoster.post_message') as mock:
        yield mock
```

### Test Pattern

```python
from django.test import TestCase, RequestFactory

class FooterApiTests(TestCase):
    def setUp(self):
        self.request = RequestFactory()
    
    def test_buy_api(self):
        request = self.request.get('/api/v2/buy/footer_info', params)
        response = views.buy_footer_v2(request)
        jsonResponse = json.loads(response.content)
        
        self.assertNotEqual(jsonResponse.get('status'), '404')
        self.assertIn('breadcrumbs', jsonResponse)
```

### Test Runner (No Database)

Tests run **WITHOUT database** by default using `NoDbTestRunner`.

### Testing Best Practices

```python
# ✅ DO: Mock external API calls
with patch('lib.slack_webhook_poster.SlackWebhookPoster.post_message') as mock:
    response = views.get_data(request)

# ✅ DO: Use RequestFactory for unit tests
request = RequestFactory().get('/api/v1/endpoint')

# ❌ DON'T: Make real external API calls
# ❌ DON'T: Hit real databases without explicit setup
```

### Test Commands

```bash
pytest                    # Run all tests
pytest tests/             # Specific directory
pytest -v                 # Verbose output
pytest -k test_name       # Specific test
```

---

## Performance Guidelines

### Caching Strategy

#### Multi-Level Caching

```python
# 1. Aerospike (distributed cache)
from lib.aerospike_client import AerospikeClient

# 2. Redis (session/temporary)
from lib.redis_singleton import RedisClient

# 3. Python Object Cache (request-scoped)
from lib.aero_cacher import AeroCacher
```

#### Caching Headers (Nginx)

```python
def addCustomHeader(response, time=900):
    """Set cache expiration to 15 minutes (900 seconds)"""
    response['X-Accel-Expires'] = time
    return response

@nginx_caching
def get_data(request):
    return HttpResponse(json.dumps(data))
```

### Batch Processing

```python
from lib.extended_list import ExtendedList

# Process in batches of 1000
ids = ['id1', 'id2', 'id3', ...]
for batch in ExtendedList(ids).in_batches(batch_size=1000):
    entities = Entity.db_find_many_by_id(batch)
    process_entities(entities)
```

### Query Optimization

```python
# Lazy loading and prefetching
class FooterModel:
    @classmethod
    def get_in_batches(cls, conditions_str="", batch_size=100):
        """Fetch large datasets in batches"""
        last_id = cls.get_last_id(conditions_str)
        offset = 0
        batch = cls.db_find_many(
            conditions_str, 
            limit=batch_size, 
            offset=offset,
            order=f"{cls.table_name}.id ASC"
        )
        while len(batch) != 0 and int(batch.last().db_data.id) <= last_id:
            yield batch
            offset += batch_size
            batch = cls.db_find_many(conditions_str, limit=batch_size, offset=offset)
```

### Threading for Parallel Requests

```python
from threading import Thread
import queue

class MultiApiRequest:
    """Execute multiple API requests in parallel"""
    def fetch_with_thread(self):
        q = queue.Queue()
        threads = []
        
        for api_url in self.api_urls:
            t = Thread(target=self._fetch_url, args=(api_url, q))
            threads.append(t)
            t.start()
        
        for t in threads:
            t.join()
        
        return q.get()
```

---

## Security Requirements

### IP Filtering

```python
class FilterIPMiddleware(MiddlewareMixin):
    allowed_ip_objects = [
        IPNetwork('182.156.204.138/32'), 
        IPNetwork('10.0.0.0/24'), 
        IPNetwork('127.0.0.1')
    ]
    disallowed_url = ['docs', 'audit_interlinking']
    
    def process_request(self, request):
        for url in self.disallowed_url:
            if url in request.path:
                ip_list = request.META.get('HTTP_X_FORWARDED_FOR', '127.0.0.1').split(',')
                ip_object = IPAddress(ip_list[0])
                for allowed_ip_object in self.allowed_ip_objects:
                    if ip_object in allowed_ip_object:
                        self.ip_flag = True
                if not self.ip_flag:
                    raise PermissionDenied
        return None
```

### Internal Request Validation

```python
def allow_internal_requests_only(orig_func):
    @wraps(orig_func)
    def wrapper(request, *args, **kwargs):
        if settings.DEBUG or '.internal.' in request.get_host() or '.svc.cluster.local' in request.get_host():
            return orig_func(request, *args, **kwargs)
        else:
            return HttpResponseForbidden(json.dumps({
                'status': 'error',
                'message': 'You are not authorized'
            }), content_type='application/json')
    return wrapper

@allow_internal_requests_only
def internal_only_api(request):
    pass
```

### Request ID Tracking

```python
class UUIDMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request.uuid = uuid.uuid1()

# Track through logs
request_id = request.META.get('HTTP_X_REQUEST_ID', 'BE_REQUEST')
ProcessLogger.info(f"request_id= {request_id} msg = {message}")
```

### CSRF Protection

```python
from django.views.decorators.csrf import csrf_exempt

# Exempt only APIs receiving JSON (not HTML forms)
@csrf_exempt
@require_POST
def webhook_handler(request):
    pass
```

### Secrets Management

**Protected files (in .gitignore):**
- `footer_api/settings_local.py`
- `footer_api/clients_secrets_bq.json`
- `.env`
- `settings.env`

Secrets are pulled from **AWS S3** during Docker build.

---

## Build & Deployment

### Docker Build

#### Production Image

```dockerfile
FROM public.ecr.aws/x2r7e9o3/housing/ubuntu:ubuntu_20.04-04.28.23-15
ENV TZ=Asia/Kolkata
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /code
COPY requirements.txt /code/
RUN pip3 install -r requirements.txt
COPY . /code/

EXPOSE 8000
CMD ["./run.sh"]
```

#### Cron Image

```dockerfile
ENV NEW_RELIC_CONFIG_FILE=/code/config/newrelic.ini
ENTRYPOINT ["newrelic-admin", "run-program", "python3", "manage.py", "run_cron"]
```

### Environment Variables

```python
ENV DJANGO_SETTINGS_MODULE=footer_api.settings
ENV IS_DOCKER=1
ENV APP_MODE=production  # or 'beta', 'development'
ENV TZ=Asia/Kolkata
```

### Local Setup

```bash
# 1. Setup virtual environment
python3.8 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create local settings
cp settings_local.py.sample footer_api/settings_local.py

# 4. Run development server
python manage.py runserver

# 5. Run crons
python manage.py run_cron
```

---

## PR Review Checklist

### Code Style
- [ ] PascalCase for classes
- [ ] snake_case for functions and variables
- [ ] UPPER_CASE for constants
- [ ] 2-space indentation
- [ ] Correct import order (Django → stdlib → third-party → local)

### Error Handling
- [ ] ProcessLogger used for all errors
- [ ] No bare `except:` clauses
- [ ] No `print()` statements
- [ ] Errors logged with context (class name, ID, etc.)

### Response Format
- [ ] API responses follow standard structure
- [ ] Includes `status`, `error`, `data` fields
- [ ] Uses ResponseHandler for consistency

### Testing
- [ ] Tests added for new functionality
- [ ] External APIs mocked
- [ ] RequestFactory used for unit tests
- [ ] No real database/API calls in tests

### Performance
- [ ] Batch processing for large datasets
- [ ] Caching headers set via `@nginx_caching`
- [ ] Query optimization (no N+1 queries)

### Security
- [ ] No secrets in code
- [ ] Internal endpoints use `@allow_internal_requests_only`
- [ ] CSRF exempt only for JSON APIs
- [ ] Request ID tracking in logs

### Patterns
- [ ] Decorator stacking order correct
- [ ] Handler classes follow naming convention
- [ ] Entity classes extend FooterModel

---

## Common Issues

### Issue: Missing ProcessLogger

**Detection:**
```python
# ❌ BAD
print("Error occurred")
logging.error("Error")
```

**Solution:**
```python
# ✅ GOOD
from lib.process_logger import ProcessLogger
ProcessLogger.error(f"Error in {method}: {traceback.format_exc()}")
```

### Issue: Bare Except Clause

**Detection:**
```python
# ❌ BAD
try:
    data = fetch()
except:
    pass
```

**Solution:**
```python
# ✅ GOOD
try:
    data = fetch()
except Exception as e:
    ProcessLogger.error(f"Fetch failed: {e}")
```

### Issue: Wrong Decorator Order

**Detection:**
```python
# ❌ BAD - nginx_caching should be outermost
@check_de_indexing
@nginx_caching
def view(request):
    pass
```

**Solution:**
```python
# ✅ GOOD
@nginx_caching
@check_de_indexing
def view(request):
    pass
```

### Issue: Non-Standard Response Format

**Detection:**
```python
# ❌ BAD
return HttpResponse(json.dumps({"result": data}))
```

**Solution:**
```python
# ✅ GOOD
return HttpResponse(json.dumps({
    "status": "success",
    "data": data,
    "error": {"status_code": 200}
}))
```

### Issue: Missing Request Context in Logs

**Detection:**
```python
# ❌ BAD
ProcessLogger.error("Error occurred")
```

**Solution:**
```python
# ✅ GOOD
ProcessLogger.error(f"Error in {self.__class__.__name__} - id = {self.id}: {e}")
```

### Issue: Direct Database Calls in Tests

**Detection:**
```python
# ❌ BAD
def test_api(self):
    Polygon.objects.create(...)
```

**Solution:**
```python
# ✅ GOOD - Use mocks or NoDbTestRunner
def test_api(self):
    with patch('polygons.classes.polygon.Polygon') as mock:
        mock.return_value.aero_data = {...}
```

### Issue: Import Order

**Detection:**
```python
# ❌ BAD - Wrong order
from lib.process_logger import ProcessLogger
import json
from django.http import HttpResponse
```

**Solution:**
```python
# ✅ GOOD - Django → stdlib → third-party → local
from django.http import HttpResponse
import json
from lib.process_logger import ProcessLogger
```

### Issue: Single Letter Variables

**Detection:**
```python
# ❌ BAD
p = Polygon(id)
e = Establishment(id)
```

**Solution:**
```python
# ✅ GOOD
polygon = Polygon(id)
establishment = Establishment(id)
```
