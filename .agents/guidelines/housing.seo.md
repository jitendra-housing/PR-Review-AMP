# housing.seo Repository Guidelines

Comprehensive coding guidelines, patterns, and conventions for the **housing.seo** repository (https://github.com/elarahq/housing.seo).

**Framework:** Django 3.2 (Python)  
**Purpose:** SEO service for HTML tags, meta information, and links generation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Code Style & Naming](#2-code-style--naming)
3. [View Patterns](#3-view-patterns)
4. [Decorator Patterns](#4-decorator-patterns)
5. [Model/Entity Patterns](#5-modelentity-patterns)
6. [Class Patterns](#6-class-patterns)
7. [Error Handling & Logging](#7-error-handling--logging)
8. [Response Patterns](#8-response-patterns)
9. [Database & Caching Patterns](#9-database--caching-patterns)
10. [URL Routing Patterns](#10-url-routing-patterns)
11. [Import Patterns](#11-import-patterns)
12. [Middleware Patterns](#12-middleware-patterns)
13. [Testing Patterns](#13-testing-patterns)
14. [Security Patterns](#14-security-patterns)
15. [Configuration Patterns](#15-configuration-patterns)
16. [Performance Patterns](#16-performance-patterns)
17. [PR Review Checklist](#17-pr-review-checklist)
18. [Common Violations & Fixes](#18-common-violations--fixes)

---

## 1. Project Overview

### Technology Stack

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
├── internal_linking/       # Link generation
├── config/                 # Configuration
├── tests/                  # Test files
├── conftest.py             # Pytest fixtures
├── pytest.ini              # Pytest config
├── requirements.txt        # Dependencies
├── Dockerfile              # Production image
└── nginx.conf              # Nginx config
```

### 🚨 IMPORTANT: No Linting Tools

This project does **NOT** use:
- ❌ Black formatter
- ❌ Flake8 or similar
- ❌ Pre-commit hooks
- ❌ isort

**Code quality relies on manual PR review and following established patterns.**

---

## 2. Code Style & Naming

### 2.1 Indentation (CRITICAL)

**Use 2 spaces for indentation (NOT 4):**

```python
# ✅ CORRECT - 2 spaces
def getProfile(request):
  profile = {}
  for key in cp.paramMap:
    if key in ['sort_key', 'routing_range']:
      continue
    value = request.GET.get(key)
    if value:
      if cp.paramMap[key]['type'] == "entity":
        profile[key] = value
  return profile

# ❌ WRONG - 4 spaces
def getProfile(request):
    profile = {}
    for key in cp.paramMap:
        value = request.GET.get(key)
```

### 2.2 Variable Naming

**camelCase for variables:**

```python
# ✅ CORRECT
filteredResults = []
polyMetadata = polygon.aero_data.get('meta')
requestParams = dict(request.GET)
aeroData = polygon.aero_data
urlTemplate = getUrlTemplateFromAero(featureType)

# ❌ WRONG - snake_case for variables
filtered_results = []
poly_metadata = polygon.aero_data.get('meta')
```

**Suffix conventions:**

```python
# Lists use _list suffix
urls_list = []
polygon_ids_list = []

# Dicts use _map suffix
entity_map = {}
feature_map = {}
```

### 2.3 Function Naming

**camelCase for public functions (primary pattern):**

```python
# ✅ CORRECT - camelCase
def getPing(request):
  pass

def getProfile(request):
  pass

def getTransactionPageMeta(request):
  pass

def addHeader(request, response):
  pass

# ✅ ACCEPTABLE - snake_case for helpers
def get_profile(request_params):
  pass

def validate_params(request_type, params_list):
  pass
```

### 2.4 Class Naming

**PascalCase always:**

```python
# ✅ CORRECT
class ResponseHandler(object):
  pass

class ProcessLogger(object, metaclass=Singleton):
  pass

class AerospikeClient:
  pass

class FooterModel(FooterAeroHandler, FooterApiHandler):
  pass

class TaxonomyHelper:
  pass
```

### 2.5 Constant Naming

**UPPER_SNAKE_CASE:**

```python
# ✅ CORRECT
STATUSES = {
  'ACTIVE': 1,
  'INACTIVE': 2
}

DEFAULT_BINS = ['breadcrumbs', 'topbuildermeta', 'meta']

AEROSPIKE_POOL_SIZE = 10

FEATURE_TYPE_MAPPING = {
  "33": "country",
  "545": "state",
}

ALL_INDIA_POLYGON_ID = "f7f5d7f50dde9452144e"
```

### 2.6 Spacing Around Operators

```python
# ✅ CORRECT - Spaces around =
profile['poly'] = [uuid]
aerodata = Polygon(k).aero_data
feature = meta['featuretype']
name = meta['name']

# ✅ CORRECT - Spaces around comparison
if service == 'buy':
  pass

if profile.get('poly'):
  pass

# ✅ CORRECT - Dictionary key-value spacing
STATUSES = {
  'ACTIVE': 1,   # Space after colon
  'INACTIVE': 2
}
```

---

## 3. View Patterns

### 3.1 Function-Based Views (Primary Pattern)

**All views are function-based, NOT class-based:**

```python
# ✅ CORRECT - Function-based view
def getPing(request):
  return addHeader(request, HttpResponse(
    json.dumps({'version': 0, 'statusCode': '2XX', 'data': 'pong'}), 
    status=200
  ))

# ❌ WRONG - Class-based view (not used)
class PingView(View):
  def get(self, request):
    pass
```

### 3.2 View Structure Pattern (REQUIRED)

```python
@csrf_exempt
def get_generic_canonical_urls(request):
  """
  Docstring with API documentation
  """
  # 1. Set main_method for logging/tracing
  request.main_method = 'views.get_generic_canonical_urls'
  
  # 2. Validate request parameters
  try:
    pages_data, entity_id, entity_name = validateGetCanonical(request)
  except Exception as e:
    response, status = ResponseHandler().get_400_response(str(e))
    return addHeader(request, HttpResponse(json.dumps(response)))
  
  # 3. Process business logic
  try:
    result = process_data(pages_data, entity_id)
  except Exception as e:
    ProcessLogger.error(traceback.format_exc())
    response, status = ResponseHandler().get_404_response()
    return addHeader(request, HttpResponse(json.dumps(response), status=status))
  
  # 4. Return response with addHeader wrapper
  response, status = ResponseHandler().get_200_response(result)
  return addHeader(request, HttpResponse(json.dumps(response), status=status))
```

### 3.3 Key View Requirements

1. **Set `request.main_method`** at view entry for logging
2. **Wrap response with `addHeader()`** always
3. **Use `HttpResponse` with `json.dumps()`** for JSON
4. **Use try-except** for error handling
5. **Use `ResponseHandler`** for response formatting

---

## 4. Decorator Patterns

### 4.1 Decorator Stacking Order (CRITICAL)

**Order matters - outermost to innermost:**

```python
# ✅ CORRECT ORDER
@redirect_to_new_canonicals        # 1st - Handle canonical redirects
@add_housing_edge_links            # 2nd - Add edge links
@redirect_specific_legacy_urls     # 3rd - Legacy redirects
@change_4bhk_apartment_type_id     # 4th - Filter transformations
def apiV2(request, service):
  request.main_method = 'views.apiV2'
  # implementation

# ✅ CORRECT - nginx_caching outermost
@nginx_caching                     # 1st - HTTP caching headers
@csrf_exempt                       # 2nd - CSRF exemption
def get_generic_canonical_urls(request):
  pass
```

### 4.2 Standard Decorator Implementation

```python
from functools import wraps

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

# Usage
@allow_internal_requests_only
def internal_only_api(request):
  pass
```

### 4.3 Validation Decorator Pattern

```python
def validate_params(request_type, params_list):
  def cache_decorator(func):
    @wraps(func)
    def _wrapper(request):
      if request_type == 'GET':
        params = request.GET.dict()
      else:
        params = json.loads(request.body)
      
      flag = True
      for param_name in params_list:
        flag = flag and bool(params.get(param_name))
      
      if flag:
        return func(request)
      else:
        return add_header(request, HttpResponseBadRequest(json.dumps({
          'error': 'params missing, params required are {}'.format(params_list)
        })))
    return _wrapper
  return cache_decorator

# Usage
@validate_params('GET', ['entity', 'entity_ids', 'service'])
def fetch_entity_taxonomy_urls(request):
  # params are guaranteed to be present
  pass
```

### 4.4 Caching Decorator Pattern

```python
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
```

---

## 5. Model/Entity Patterns

### 5.1 Entity Class Pattern (REQUIRED)

```python
class Polygon(FooterModel, TaxonomyHelper, PolygonSandwichUrlCacher, PolygonHelper):
  # Class-level configuration (REQUIRED)
  db_name = settings.DATABASE_ALIASES['HR']
  table_name = 'polygons'
  db_columns = ["bbox.url_name as bburlname", "bbox.uuid as cityuuid", ...]
  join_str = "LEFT OUTER JOIN polygons as bbox ON bbox.uuid = polygons.bounding_box_uuids[1]"
  aero_set_name = 'polygons'
  key_name = 'uuid'
  
  # Status constants as class attribute dict
  STATUSES = {
    'ACTIVE': 1,
    'INACTIVE': 2
  }
  
  # Default bins as class constant
  DEFAULT_BINS = ['breadcrumbs', 'topbuildermeta', 'meta', 'polyinx', 'collections']
  
  def __init__(self, id, aero_fetch=True, bins=DEFAULT_BINS):
    self.id = id
    self.city = None
    self.featured_localities = None
    self.api_url = "{}/api/v1/polygon/details/{}".format(
      settings.SERVICE_URLS['regions']['internal'], 
      self.id
    )
    # Initialize parent class
    FooterModel.__init__(self, aero_fetch=aero_fetch, bins=bins)

  @classmethod
  def get_polygon(cls, polygon_uuid):
    """Factory method - returns correct subclass"""
    polygon = Polygon(polygon_uuid)
    try:
      if int(polygon.aero_data.meta.get('featuretype')) in [37, 1002, 1003, 546, 1005]:
        from polygons.classes.city import City
        city = City(polygon_uuid, aero_fetch=False)
        city.copy_data_from_polygon(polygon)
        polygon = city
    except:
      pass
    return polygon

  def is_valid(self):
    return bool(self.aero_data.meta) and self.aero_data.meta['status_id'] == Polygon.STATUSES['ACTIVE']
  
  @classmethod
  def aero_required_fields(cls):
    return ['bburlname', 'displayname', 'name']
```

### 5.2 Entity Class Requirements

1. **Multiple inheritance** from mixins and base class
2. **Class-level configuration**: `db_name`, `table_name`, `aero_set_name`, `key_name`
3. **Status constants** as class dict attribute
4. **DEFAULT_BINS** as class constant
5. **Initialize parent** in `__init__`
6. **Factory methods** with `@classmethod`
7. **`is_valid()` method** for validation

### 5.3 Batch Processing Pattern

```python
@classmethod
def find_by_ids_in_batches(cls, ids, batch_size=100, bins=['meta']):
  for i in range(0, len(ids), batch_size):
    yield cls.aero_find_many(ids[i:i+batch_size], bins=bins)

# Usage
for establishments in Establishment.find_by_ids_in_batches(est_ids, bins=['meta', 'search_count']):
  for establishment in establishments:
    try:
      process(establishment)
    except Exception as e:
      pass
```

---

## 6. Class Patterns

### 6.1 Multiple Inheritance Pattern

```python
# ✅ CORRECT - Multiple inheritance from mixins
class Polygon(FooterModel, TaxonomyHelper, PolygonSandwichUrlCacher, PolygonHelper):
  pass

class City(Polygon, CityHelper):
  pass

class Builder(FooterModel, TaxonomyHelper, BuilderHelper):
  pass
```

### 6.2 Singleton Pattern (Metaclass)

```python
class Singleton(type):
  _instances = {}
  def __call__(cls, *args, **kwargs):
    if cls not in cls._instances:
      cls._instances[cls] = super(Singleton, cls).__call__(*args, **kwargs)
    return cls._instances[cls]

class ProcessLogger(object, metaclass=Singleton):
  def __init__(self):
    process_logger = self
    process_logger.logger_object = Logger()
  
  @classmethod
  def logger(cls):
    try:
      process_logger = ProcessLogger()
      try:
        process_logger.logger_object
      except:
        cls.set_process()
      return process_logger.logger_object.logger
    except:
      return logging.getLogger()
```

### 6.3 Thread-Safe Singleton

```python
class ThreadSafeSingleton(type):
  """Thread-safe singleton with double-checked locking"""
  _instances = {}
  _locks = {}
  _locks_creation_lock = threading.Lock()

  def __call__(cls, *args, **kwargs):
    if cls not in cls._instances:
      if cls not in cls._locks:
        with cls._locks_creation_lock:
          if cls not in cls._locks:
            cls._locks[cls] = threading.Lock()
      
      lock = cls._locks[cls]
      with lock:
        if cls not in cls._instances:
          try:
            instance = super(ThreadSafeSingleton, cls).__call__(*args, **kwargs)
            cls._instances[cls] = instance
          except Exception:
            raise
    return cls._instances[cls]

class RedisSingleton(metaclass=ThreadSafeSingleton):
  @classmethod
  def get_redis_connection(cls):
    singleton_obj = cls()
    return singleton_obj.redis_client
```

### 6.4 Abstract Base Class Pattern

```python
class FooterModel(FooterAeroHandler, FooterApiHandler):
  """Base model for all entities"""
  implicit_condition = ""
  
  def __init__(self, aero_fetch=True, prefetch=[], bins=[]):
    self.db_data = DictInstance({})
    self.aero_data = DictInstance({})
    self.api_data = DictInstance({})
    FooterAeroHandler.__init__(self, prefetch=prefetch, bins=bins)
    try:
      if self.id not in [None, '', 'None'] and (aero_fetch or len(prefetch) != 0):
        self.aero_fetch()
    except Exception as ex:
      ProcessLogger.error("FooterModel init error for class = {} - id = {}".format(
        self.__class__.__name__, self.id
      ))

  def is_valid(self, refetch=False):
    if bool(refetch) and bool(self.aero_data) and not bool(self.aero_data.get('meta')): 
      self.sync_using_api()
    return bool(self.aero_data)
```

---

## 7. Error Handling & Logging

### 7.1 Exception Handling Pattern (REQUIRED)

```python
# ✅ CORRECT - Try-except with ProcessLogger
try:
  pages_data, entity_id, entity_name = validateGetCanonical(request)
except Exception as e:
  response, status = ResponseHandler().get_400_response(str(e))
  return addHeader(request, HttpResponse(json.dumps(response)))

# ✅ CORRECT - With traceback logging
try:
  polygon = Polygon(request.GET.get('poly'), bins=['meta'])
  if bool(polygon) and polygon.is_valid():
    meta = polygon.aero_data.meta
except Exception as e:
  ProcessLogger.error(traceback.format_exc())
  response, status = ResponseHandler().get_404_response()
  return addHeader(request, HttpResponse(json.dumps(response), status=status))

# ✅ CORRECT - Catch-all with continue
try:
  urlTemplate = getUrlTemplateFromAero(int(KEYFEATURE.replace('-', '')))
except:
  ProcessLogger.error(traceback.format_exc())
  # Continue with defaults
```

### 7.2 ProcessLogger Usage (REQUIRED)

**Always use ProcessLogger, never print():**

```python
# ✅ CORRECT - ProcessLogger methods
ProcessLogger.error(traceback.format_exc())
ProcessLogger.error("FooterModel init error for class = {} - id = {}".format(
  self.__class__.__name__, self.id
))
ProcessLogger.info("v2_get_canonicals: data: {}".format(data))

# ✅ CORRECT - With ignore_request_check
ProcessLogger.error("Some error", ignore_request_check=True)

# ❌ WRONG - Never use print
print("Error occurred")  # NEVER!
print(traceback.format_exc())  # NEVER!
```

### 7.3 Logging Context (REQUIRED)

**Include context in error messages:**

```python
# ✅ CORRECT - With context
ProcessLogger.error("FooterModel init error for class = {} - id = {}".format(
  self.__class__.__name__, self.id
))

ProcessLogger.error("Polygon fetch failed - uuid = {} - error = {}".format(
  polygon_uuid, traceback.format_exc()
))

# ❌ WRONG - No context
ProcessLogger.error("Error occurred")
ProcessLogger.error(str(e))
```

### 7.4 Set main_method (REQUIRED)

**Set at view entry for request tracing:**

```python
def apiV2(request, service):
  request.main_method = 'views.apiV2'  # REQUIRED
  # rest of implementation

def get_generic_canonical_urls(request):
  request.main_method = 'views.get_generic_canonical_urls'  # REQUIRED
  # rest of implementation
```

---

## 8. Response Patterns

### 8.1 ResponseHandler Class (REQUIRED)

```python
class ResponseHandler(object):
  def __init__(self, *args, **kwargs):
    pass

  def get_404_response(self):
    return [{'error': {'status_code': 404}}, 200]

  def get_410_response(self):
    return [{'error': {'status_code': 410, 'message': "This page is gone"}}, 200]

  def get_301_response(self, redirect_url):
    if not bool(redirect_url) or redirect_url == 'None':
      redirect_url = '/'
    return [{'error': {'status_code': 301, 'redirect_url': redirect_url}}, 200]

  def get_400_response(self, message):
    return [{'error': {'status_code': 400, 'message': message}}, 200]

  def get_500_response(self, message):
    return [{'error': {'status_code': 500, 'message': message}}, 200]

  def get_200_response(self, response):
    return [response, 200]
```

### 8.2 Response Usage Pattern

```python
# ✅ CORRECT - Use ResponseHandler
response, status = ResponseHandler().get_404_response()
return addHeader(request, HttpResponse(json.dumps(response), status=status))

response, status = ResponseHandler().get_301_response('/new-canonical-url')
return addHeader(request, HttpResponse(json.dumps(response)))

response, status = ResponseHandler().get_200_response(result_data)
return addHeader(request, HttpResponse(json.dumps(response), status=status))
```

### 8.3 JSON Response Structure

```python
# Success response
{
  "title": "Properties in Mumbai",
  "heading": {"h1": "Buy Properties in Mumbai"},
  "breadcrumbs": [
    {"href": "/in/buy/mumbai", "name": "Mumbai"}
  ],
  "meta_description": "Find properties for sale in Mumbai",
  "canonical": "/in/buy/mumbai",
  "page_type": "HOUSING_CITY_SERP_BUY"
}

# Error response (HTTP 200 but with error object)
{
  "error": {
    "status_code": 404
  }
}

# Redirect response
{
  "error": {
    "status_code": 301,
    "redirect_url": "/new-path"
  }
}
```

### 8.4 Always Wrap with addHeader

```python
# ✅ CORRECT - Always use addHeader
return addHeader(request, HttpResponse(json.dumps(response), status=status))

# ❌ WRONG - Missing addHeader
return HttpResponse(json.dumps(response), status=status)
```

---

## 9. Database & Caching Patterns

### 9.1 Aerospike Caching Pattern

```python
class AeroCacher():
  aero_bin = 'cache_data'
  datetime_format = "%m/%d/%Y, %H:%M:%S"
  aero_fetch_multi_batch_size = 10
  NAMESPACE = getattr(settings, 'FOOTER_AERO_NAMESPACE', 'housing_seo')

  @classmethod
  def fetch_aero_tuple(cls, cache_key):
    """Return aero_key_tuple (namespace, set, key)"""
    return (cls.NAMESPACE, 'seo_cache', cache_key)

  @classmethod
  def read_multi(cls, cache_keys):
    """Read multiple cache keys, return dict"""
    cache_keys = ExtendedList(cache_keys)
    response = {}
    for cache_key_batch in cache_keys.in_batches(cls.aero_fetch_multi_batch_size):
      aero_key_tuples = [cls.fetch_aero_tuple(cache_key) for cache_key in cache_key_batch]
      aero_response_list = AerospikeClient.get_client().get_many(aero_key_tuples)
      for aero_response in aero_response_list:
        key_tuple, meta, aero_data = aero_response
        namespace_name, set_name, key, byte_array = key_tuple
        response.update({key: aero_data.get(cls.aero_bin)}) if bool(aero_data) else None
    return response

  @classmethod
  def write(cls, cache_key, cache_value, expires_in=None):
    """Write cache with optional TTL"""
    aero_meta = {'ttl': expires_in} if bool(expires_in) else {}
    AerospikeClient.get_client().put(
      cls.fetch_aero_tuple(cache_key), 
      {cls.aero_bin: cache_value}, 
      meta=aero_meta
    )
    return True
```

### 9.2 Entity Data Access Pattern

```python
# Single entity fetch
polygon = Polygon(request.GET.get('poly'))
meta = polygon.aero_data.meta
name = polygon.aero_data.meta.get('name')

# With specific bins
polygon = Polygon(polygon_uuid, bins=['meta', 'breadcrumbs'])

# Without auto-fetch
polygon = Polygon(polygon_uuid, aero_fetch=False)

# Batch fetch
polygons = Polygon.aero_find_many(polygon_uuids, bins=bins)
```

### 9.3 Database Query Pattern

```python
# Class method for DB queries
@classmethod
def db_find(cls, key_id):
  try:
    key_name = "{}.{}".format(cls.table_name, cls.key_name)
    key_val = key_id
    if type(key_val) in [str, str]:
      key_val = "'{}'".format(key_val)
    where_str = "{} = {}".format(key_name, key_val)
    
    if cls.join_str != "":
      return cls.select(cls.db_columns).join(cls.join_str).where(where_str).fetch().first()
    else:
      return cls.select(cls.db_columns).where(where_str).fetch().first()
  except Exception as e:
    ProcessLogger.error("FooterModel.db_find exception: {}".format(traceback.format_exc()))
    return None
```

---

## 10. URL Routing Patterns

### 10.1 URL Definition Pattern

```python
from django.urls import path, re_path, include
from footer_api.views import *

urlpatterns = [
  # Simple paths
  path('ping/', getPing),
  path('healthcheck/', getHealthCheck),
  
  # Static API paths
  path('api/v1/transaction/meta/', getTransactionPageMeta),
  
  # Dynamic routes with named groups
  re_path(r'api/v2/(?P<service>[a-z-]+)/footer_info', apiV2),
  re_path(r'api/v1/(?P<service>\w+)/canonicals', getCanonicalUrls),
  
  # Include external app URLs
  re_path(r'^api/', include('api.urls')),
]
```

### 10.2 URL Patterns

| Pattern | Use Case |
|---------|----------|
| `path()` | Simple static routes |
| `re_path()` | Dynamic routes with regex |
| `(?P<name>pattern)` | Named capture groups |
| `[a-z-]+` | Lowercase with hyphens |
| `\w+` | Alphanumeric with underscore |

---

## 11. Import Patterns

### 11.1 Import Order (REQUIRED)

```python
# 1. Standard library
import uuid
import traceback
import json
import datetime
import time
from collections import OrderedDict
from threading import Thread
from functools import wraps

# 2. Third-party
from django.shortcuts import render
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import requests

# 3. Local imports
from lib.process_logger import ProcessLogger
from lib.response_handler import ResponseHandler
from footer_common.classes.decorators import allow_internal_requests_only
from polygons.classes.polygon import Polygon
from builders.classes.builder import Builder
```

### 11.2 Wildcard Imports

```python
# ✅ ACCEPTABLE - In urls.py for views
from footer_api.views import *

# ❌ WRONG - In other files
from polygon.classes import *  # Don't do this
```

---

## 12. Middleware Patterns

### 12.1 UUID Middleware Pattern

```python
class UUIDMiddleware(MiddlewareMixin):
  def process_request(self, request):
    request.log_messages = []
    request.main_method = 'Undefined'
    request.start_time = datetime.datetime.now()
    request.uuid = uuid.uuid1()
```

### 12.2 Logger Middleware Pattern

```python
class LoggerMiddleware(MiddlewareMixin):
  def process_response(self, request, response):
    request.status_code = response.status_code
    request.finish_time = datetime.datetime.now()
    ProcessLogger.output_logs()
    return response
```

### 12.3 IP Filter Middleware Pattern

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

---

## 13. Testing Patterns

### 13.1 Pytest Configuration

```ini
# pytest.ini
[pytest]
DJANGO_SETTINGS_MODULE = footer_api.settings
env = DJANGO_TEST_ENV=true
```

### 13.2 Test Fixtures (Auto-disable Slack)

```python
# conftest.py
import pytest
from unittest.mock import patch

@pytest.fixture(autouse=True)
def disable_slack_notifications():
  """Automatically disable Slack notifications for all tests"""
  with patch('lib.slack_webhook_poster.SlackWebhookPoster.post_message') as mock:
    yield mock
```

### 13.3 Test Pattern

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

### 13.4 Testing Requirements

- Mock external API calls
- Use RequestFactory for unit tests
- No real database/API calls in tests
- Tests run WITHOUT database (NoDbTestRunner)

---

## 14. Security Patterns

### 14.1 Internal Request Validation

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
```

### 14.2 CSRF Exemption

```python
# Only exempt for JSON APIs
@csrf_exempt
@require_POST
def webhook_handler(request):
  pass
```

### 14.3 Protected Files

**Files in .gitignore:**
- `footer_api/settings_local.py`
- `footer_api/clients_secrets_bq.json`
- `.env`
- `settings.env`

---

## 15. Configuration Patterns

### 15.1 Settings Pattern

```python
# settings.py
from .settings_local import *  # Import local settings

DATABASE_ALIASES = {
  'HR': 'housing_rails',
  'default': 'default'
}

SERVICE_URLS = {
  'regions': {
    'internal': 'http://regions.internal.housing.com'
  }
}
```

### 15.2 Environment Variables

```python
# Docker environment
ENV DJANGO_SETTINGS_MODULE=footer_api.settings
ENV IS_DOCKER=1
ENV APP_MODE=production
ENV TZ=Asia/Kolkata

# Logging behavior
if os.environ.get('IS_DOCKER') == None:
  file_handler = logging.FileHandler(self.path)
else:
  handler = logging.StreamHandler(sys.stdout)
```

---

## 16. Performance Patterns

### 16.1 Batch Processing

```python
# Use ExtendedList for batching
from lib.extended_list import ExtendedList

ids = ['id1', 'id2', 'id3', ...]
for batch in ExtendedList(ids).in_batches(batch_size=1000):
  entities = Entity.db_find_many_by_id(batch)
  process_entities(entities)
```

### 16.2 Caching Headers

```python
def addCustomHeader(response, time=900):
  """Set cache expiration to 15 minutes (900 seconds)"""
  response['X-Accel-Expires'] = time
  return response

@nginx_caching
def get_data(request):
  return HttpResponse(json.dumps(data))
```

### 16.3 Threading for Parallel Requests

```python
from threading import Thread
import queue

class MultiApiRequest:
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

## 17. PR Review Checklist

### Code Style
- [ ] **2-space indentation** (not 4)
- [ ] camelCase for variables
- [ ] camelCase/snake_case for functions
- [ ] PascalCase for classes
- [ ] UPPER_SNAKE_CASE for constants
- [ ] Correct import order

### View Patterns
- [ ] Function-based views (not class-based)
- [ ] `request.main_method` set at entry
- [ ] Response wrapped with `addHeader()`
- [ ] `ResponseHandler` used for responses
- [ ] `HttpResponse` with `json.dumps()`

### Decorator Patterns
- [ ] Correct stacking order
- [ ] `@wraps` used in custom decorators
- [ ] `nginx_caching` outermost when present

### Error Handling
- [ ] `ProcessLogger` used (not print)
- [ ] `traceback.format_exc()` in error logs
- [ ] Context included in error messages
- [ ] Try-except around risky operations

### Entity Patterns
- [ ] Class-level configuration (db_name, table_name)
- [ ] STATUSES as class dict
- [ ] DEFAULT_BINS as class constant
- [ ] Parent `__init__` called
- [ ] Factory methods with `@classmethod`

### Response Patterns
- [ ] `ResponseHandler` used
- [ ] Correct error structure (`{error: {status_code: N}}`)
- [ ] `addHeader()` wrapper used

### Testing
- [ ] Mocks for external APIs
- [ ] RequestFactory for unit tests
- [ ] No real API/database calls

---

## 18. Common Violations & Fixes

### Violation 1: Wrong Indentation (HIGH)

```python
# ❌ DETECTED - 4 spaces
def getProfile(request):
    profile = {}
    return profile

# ✅ FIX - 2 spaces
def getProfile(request):
  profile = {}
  return profile
```

### Violation 2: Using print() (HIGH)

```python
# ❌ DETECTED
print("Error occurred")
print(traceback.format_exc())

# ✅ FIX
ProcessLogger.error("Error: {}".format(traceback.format_exc()))
```

### Violation 3: Missing main_method (MEDIUM)

```python
# ❌ DETECTED
def apiV2(request, service):
  # Missing main_method
  pass

# ✅ FIX
def apiV2(request, service):
  request.main_method = 'views.apiV2'
  pass
```

### Violation 4: Missing addHeader (MEDIUM)

```python
# ❌ DETECTED
return HttpResponse(json.dumps(response), status=status)

# ✅ FIX
return addHeader(request, HttpResponse(json.dumps(response), status=status))
```

### Violation 5: Wrong Decorator Order (HIGH)

```python
# ❌ DETECTED - nginx_caching not outermost
@csrf_exempt
@nginx_caching
def view(request):
  pass

# ✅ FIX
@nginx_caching
@csrf_exempt
def view(request):
  pass
```

### Violation 6: Error Without Context (MEDIUM)

```python
# ❌ DETECTED
ProcessLogger.error("Error occurred")

# ✅ FIX
ProcessLogger.error("Error in {} for id = {}: {}".format(
  self.__class__.__name__, self.id, traceback.format_exc()
))
```

### Violation 7: Bare Except Clause (MEDIUM)

```python
# ❌ DETECTED
try:
  data = fetch()
except:
  pass

# ✅ FIX
try:
  data = fetch()
except Exception as e:
  ProcessLogger.error("Fetch failed: {}".format(traceback.format_exc()))
```

### Violation 8: snake_case Variables (LOW)

```python
# ❌ DETECTED
filtered_results = []
poly_metadata = polygon.aero_data

# ✅ FIX
filteredResults = []
polyMetadata = polygon.aero_data
```

### Violation 9: Class-Based View (HIGH)

```python
# ❌ DETECTED
class PingView(View):
  def get(self, request):
    pass

# ✅ FIX
def getPing(request):
  pass
```

### Violation 10: Missing ResponseHandler (MEDIUM)

```python
# ❌ DETECTED
return addHeader(request, HttpResponse(json.dumps({'error': 'Not found'})))

# ✅ FIX
response, status = ResponseHandler().get_404_response()
return addHeader(request, HttpResponse(json.dumps(response), status=status))
```

### Violation 11: Direct Return Without json.dumps (HIGH)

```python
# ❌ DETECTED
return HttpResponse(response)

# ✅ FIX
return addHeader(request, HttpResponse(json.dumps(response), status=status))
```

### Violation 12: Wildcard Import in Non-View Files (MEDIUM)

```python
# ❌ DETECTED - In helper.py
from polygon.classes import *

# ✅ FIX
from polygon.classes.polygon import Polygon
from polygon.classes.city import City
```
