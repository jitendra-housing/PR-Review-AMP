# Khoj Repository Guidelines

Comprehensive coding guidelines and standards for the **khoj** repository (https://github.com/elarahq/khoj).

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Code Style & Formatting](#code-style--formatting)
4. [Architecture & Module Structure](#architecture--module-structure)
5. [Component Patterns](#component-patterns)
6. [Custom Annotations](#custom-annotations)
7. [Transformer & Query Builder Patterns](#transformer--query-builder-patterns)
8. [Data Models](#data-models)
9. [State Management & Caching](#state-management--caching)
10. [Messaging & Events](#messaging--events)
11. [Error Handling](#error-handling)
12. [Testing Requirements](#testing-requirements)
13. [Build & Deployment](#build--deployment)
14. [Logging](#logging)
15. [Security Requirements](#security-requirements)
16. [PR Review Checklist](#pr-review-checklist)
17. [Common Issues](#common-issues)

---

## Project Overview

**Khoj** is a Java-based Search Microservice built with Spring Boot. It provides Elasticsearch-powered search services for real estate listings.

**Primary Functions:**
- Property search (Buy, Rent, Commercial, PG, Flatmate)
- Elasticsearch query building and execution
- Filter and facet processing
- Geo-location based search
- Caching and performance optimization

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Language | Java 21 |
| Framework | Spring Boot 3.3.3, Spring Cloud 2023.0.3 |
| Search Engine | Elasticsearch |
| Database | PostgreSQL, MySQL |
| Caching | Aerospike (primary), Redis (secondary) |
| Message Queue | RabbitMQ, Kafka |
| Build Tool | Maven |
| Code Style | Google Java Format (v1.24.0) |
| Linting | Checkstyle (v3.1.2) |

---

## Code Style & Formatting

### 🚨 CRITICAL: Google Java Format Required

- **Code Style**: Google Java Format v1.24.0
- **Checkstyle**: Enforced during Maven `verify` phase
- **GitHub Actions**: Super Linter validates PRs

### IDE Setup (Required)

**IntelliJ/Android Studio:**
- Install plugin: https://github.com/google/google-java-format

**Eclipse:**
- Install plugin: https://github.com/google/google-java-format#eclipse

### Local Formatting

```bash
# Download formatter
curl -L -o google-java-format.jar https://github.com/google/google-java-format/releases/download/v1.24.0/google-java-format-1.24.0-all-deps.jar

# Format single file
java -jar google-java-format.jar -r /path_to_file.java

# Format folder
java -jar google-java-format.jar -r /path_to_folder/**/*.java
```

### Security Linting

Checkstyle detects hardcoded AWS keys:
```xml
<module name="RegexpMultiline">
  <property name="format" value="(?i)\baws\b.*(?i)\bkey\b\s*=[\t\f\r ]*\S+"/>
  <property name="message" value="Hardcoded AWS Key detected"/>
</module>
```

---

## Architecture & Module Structure

### Module Organization

```
khoj/
├── core/          # Core search logic, ES config, shared models
├── web/           # REST API controllers and services
├── worker/        # Background job processing (RabbitMQ)
├── util/          # Shared utility classes
├── cron/          # Scheduled batch operations
└── logReplay/     # Log replay utilities
```

**Key Rule**: Library modules must NOT have `<plugin><build></build>` tags in pom.xml.

### Layered Architecture (Per Module)

```
module/
├── config/           # Spring configuration (@Configuration)
├── controller/       # REST endpoints (@RestController)
├── service/          # Business logic (@Service)
├── transformer/      # Request/Response transformation
├── builder/          # Builder pattern implementations
├── models/           # Data models and query params
├── dto/              # Data Transfer Objects
├── request/          # Request parameter classes
├── response/         # Response classes
├── enums/            # Enumeration classes
├── constants/        # Constant definitions
├── annotations/      # Custom annotations
├── filters/          # Request/response filters
├── validators/       # Request validators
├── helper/           # Helper utilities
├── events/           # Event handling
└── healthindicators/ # Health checks
```

---

## Component Patterns

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Controllers | `{Entity}Controller` or `{Entity}ControllerV{n}` | `CommercialControllerV2` |
| Services | `{Entity}Service` or `Abstract{Entity}Service` | `SearchService`, `AbstractSearchService` |
| Models | `{Entity}Params`, `{Entity}Dto` | `CommercialParams`, `SearchRequestDto` |
| Requests | `{Entity}Request` or `{Entity}Params` | `SearchRequest`, `RentParams` |
| Responses | `{Entity}Response` or `{Entity}ResponseDTO` | `CommercialResponse` |
| Transformers | `{Entity}Transformer` | `SearchRequestToEsQueryTransformer` |
| Builders | `{Entity}Builder` | `SearchRequestBuilder` |
| Utilities | `{Name}Util` or `{Name}Helper` | `SearchTransformerUtil` |
| Annotations | `@{PurposeName}` | `@DocFilter`, `@Range` |
| Enums | `{Name}Enum` or `{Name}` | `FilterType`, `FilterContext` |

### Class Annotations (Lombok + Spring)

```java
@Data                    // Generates getters, setters, equals, hashCode, toString
@AllArgsConstructor      // Constructor with all fields
@NoArgsConstructor       // No-argument constructor
@Builder                 // Builder pattern
@Service                 // Spring service bean
@Configuration           // Spring configuration
@RestController          // REST API controller
@Component               // Generic Spring bean
@Transactional           // Transaction management
@Log4j2                  // Lombok logging
```

### Request Class Pattern

```java
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class CommercialParams implements Serializable {
    @DocFilter(ctx = FilterContext.PROPERTY_ID, preProcess = COMMA_SEPARATED_TO_LIST)
    private String property_id;
    
    @Range(ctx = FilterContext.PRICE)
    private RangeCriteria price;
}
```

### Service Layer Pattern

```java
@Service
public abstract class SearchService<O, I> {
    
    public abstract O search(@NonNull final I searchParams) throws Exception;
    
    public O search(
        @NonNull final I searchParams,
        HttpServletRequest httpRequest,
        HttpServletResponse httpResponse) throws Exception {
        return search(searchParams);
    }
    
    public abstract SearchCountResponse searchCount(@NonNull final I searchParams) 
        throws Exception;
    
    public abstract O searchV2(@NonNull final I searchParams) throws Exception;
}
```

**Key Patterns:**
- Abstract service classes for common functionality
- Method overloading for HTTP context
- `@NonNull` annotations for null-safety
- Support for multiple API versions

---

## Custom Annotations

### @DocFilter (Elasticsearch Filtering)

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface DocFilter {
    FilterContext ctx();                              // ES field mapping
    PreProcess preProcess() default SINGLETON_LIST;   // Value processing
    FilterValueOperator operator() default OR;        // Query operator
    FilterType filterType() default MUST;             // Query type
}

// Usage
@DocFilter(ctx = FilterContext.PROPERTY_ID, preProcess = COMMA_SEPARATED_TO_LIST)
private String property_id;

@DocFilter(ctx = FilterContext.PRICE, filterType = FilterType.MUST)
private String price;
```

### @Range (Range-based Filtering)

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface Range {
    FilterContext ctx();
    FilterType filterType() default FilterType.MUST;
}

// Usage - Field MUST be RangeCriteria type
@Range(ctx = FilterContext.PRICE)
private RangeCriteria price;

@Range(ctx = FilterContext.AREA, filterType = FilterType.MUST_NOT)
private RangeCriteria area;
```

### @DateRange (Date-based Filtering)

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface DateRange {
    FilterContext ctx();
    String format() default "";                       // e.g., "dd/MM/yyyy"
    FilterType filterType() default FilterType.MUST;  // Only MUST/MUST_NOT
}

// Usage - Field MUST be DateRangeCriteria type
@DateRange(ctx = FilterContext.AVAILABLE_FROM, format = "dd/MM/yyyy")
private DateRangeCriteria available_from;
```

### FilterType Enum

```java
public enum FilterType {
    MUST,           // Document must match
    MUST_NOT,       // Document must not match
    SHOULD,         // Document should match (optional)
    MUST_FILTER,    // Filter clause (no score impact)
    MUST_NOT_FILTER,// Negative filter clause
    SHOULD_FILTER   // Optional filter clause
}
```

### PreProcess Enum

```java
public enum PreProcess {
    COMMA_SEPARATED_TO_LIST,  // Split comma-separated strings
    SINGLETON_LIST            // Wrap single value in list
}
```

---

## Transformer & Query Builder Patterns

### Transformer Interface

```java
public interface Transformer<O, I> {
    O transform(I request) throws Exception;
}

public interface RequestToEsQueryTransformer<T> {
    SearchSourceBuilder transformToBuilder(@NonNull final T request);
}
```

### Implementation Pattern

```java
@Log4j2
@AllArgsConstructor
public class SearchRequestToEsQueryTransformer
    implements RequestToEsQueryTransformer<SearchRequest> {

    private CriteriaToEsQueryTransformer<SearchSourceBuilder> criteriaToEsQueryTransformer;
    private SearchTransformerUtil searchTransformerUtil;

    @Override
    public SearchSourceBuilder transformToBuilder(@NonNull final SearchRequest searchRequest) {
        SearchSourceBuilder builder = criteriaToEsQueryTransformer.createCriteriaQuery(searchRequest);
        searchTransformerUtil.populateGeoDistanceSort(builder, searchRequest);
        searchTransformerUtil.populateSortOrderArguments(builder, searchRequest);
        searchTransformerUtil.populateFunctionScoreBuilder(builder, searchRequest);
        searchTransformerUtil.populatePaginationParams(builder, searchRequest);
        return builder;
    }

    public SearchSourceBuilder transformToCountBuilder(@NonNull final SearchRequest searchRequest) {
        return criteriaToEsQueryTransformer.createCriteriaQuery(searchRequest);
    }
}
```

### Query Creator Pattern

```java
public class TermQueryCreator {
    public QueryBuilder createTermQuery(
        @NonNull final String fieldName,
        @NonNull final List<Object> values,
        final boolean nestedFiltering) {
        // Implementation
    }

    public QueryBuilder createTermQuery(
        @NonNull final String fieldName,
        @NonNull final List<Object> values,
        final boolean nestedFiltering,
        Float boostValue) {
        QueryBuilder termQueryBuilder = createTermQuery(fieldName, values, nestedFiltering);
        if (boostValue != null) {
            termQueryBuilder.boost(boostValue);
        }
        return termQueryBuilder;
    }
}
```

---

## Data Models

### SearchRequest Structure

```java
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SearchRequest {
    private Integer distanceSortPosition;
    private List<Filter> mustList;
    private List<RangeFilter> mustRangeFilters;
    private List<RangeFilter> shouldRangeFilters;
    private List<DateRangeFilter> mustDateRangeFilters;
    private List<Filter> mustFilterList;
    private List<Filter> shouldList;
    private List<Filter> mustNotFilterList;
    private List<Filter> shouldFilterList;
    private MustNotSearchRequest mustNotSearchRequest;
    private List<Sort> sort;
    private Pagination pagination;
    private List<String> includeFields;
    private List<String> excludeFields;
    private List<GeoFilter> geoMustFilterList;
    private List<GeoFilter> geoMustNotFilterList;
    private List<GeoFilter> geoDistanceSortList;
    private List<RelevanceFunctionDTO> relevanceFunctionDTOS;
}
```

**Important**: Use `SearchRequest.getDeepCopy()` for defensive copies.

### Filter Model

```java
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Filter {
    private String field;
    private List<Object> values;
    private boolean nestedFiltering;
    private Float boostValue;
}

@AllArgsConstructor
@Data
@NoArgsConstructor
@Builder
public class RangeCriteria {
    private Long min;
    private Long max;
}
```

---

## State Management & Caching

### Cache Hierarchy

1. **Aerospike** (Primary distributed cache)
   - Namespaces: `housing`, `filter_api`
   - Sets: `khoj_cache`, `khoj_filter_cache`, `khoj_combined_cards_cache`

2. **Redis** (Secondary cache)
   - Configurable host/port/db via properties
   - Transaction support enabled

3. **In-Memory** (Request-scoped)
   - Spring request-scoped beans

### Aerospike Configuration

```java
@Configuration
public class AerospikeConfig {
    
    @Bean(name = "aeroSpikeCache")
    public AeroSpikeCache getAeroSpikeCache(
        @Qualifier("primaryAerospike") AerospikeClient client) {
        return new AeroSpikeCache(client, NAME_SPACE, SET, BIN);
    }

    @Bean(name = "primaryAerospike")
    public AerospikeClient primaryAerospikeClient() {
        // Cluster configuration
    }
}
```

### Redis Configuration

```java
@Configuration
public class RedisConfig {
    
    @Bean
    JedisConnectionFactory jedisConnectionFactory() {
        RedisStandaloneConfiguration config =
            new RedisStandaloneConfiguration(HOST, PORT);
        config.setDatabase(DB);
        return new JedisConnectionFactory(config);
    }

    @Bean(name = "redisTemplate")
    public StringRedisTemplate stringRedisTemplate() {
        StringRedisTemplate template = new StringRedisTemplate(jedisConnectionFactory());
        template.setEnableTransactionSupport(true);
        return template;
    }
}
```

---

## Messaging & Events

### RabbitMQ Queue Naming Convention

```java
public static final String FLATMATE_INDEXER_QUEUE = "khoj-flatmate-indexer-queue";
public static final String COMMERCIAL_INDEXER_QUEUE = "khoj-commercial-indexer-queue";
public static final String FLATMATE_INDEXER_KEY = "khoj-flatmate-indexer-key";
public static final String COMMERCIAL_INDEXER_KEY = "khoj-commercial-indexer-key";
```

### Dead Letter Queue Pattern

```java
public static final String DEAD_LETTER_QUEUE = "housing.khoj.deadLetter.queue";
public static final String X_DEAD_LETTER_EXCHANGE = "x-dead-letter-exchange";
public static final String X_DEAD_LETTER_ROUTING_KEY = "x-dead-letter-routing-key";
```

### RabbitMQ Configuration

```java
@Configuration
@EnableRabbit
public class RabbitMQConfig {
    
    @Bean
    TopicExchange khojExchange() {
        return new TopicExchange(khojExchangeName);
    }

    @Bean
    public RabbitTemplate rabbitTemplate(CachingConnectionFactory connectionFactory) {
        final RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setExchange(khojExchangeName);
        return rabbitTemplate;
    }
}
```

---

## Error Handling

### Error Code Pattern

```java
@Getter
@AllArgsConstructor
public enum SearchAPIErrors {
    ES_COUNT_API_ERROR(1, "es count client exception"),
    POLYGON_UUID_MISSING(2, "polygon uuid is missing"),
    ES_QUERY_NOT_BUILD(3, "elastic search query could not be built"),
    VALIDATION_FAILED(13, "search validation failed"),
    SERVICE_NOT_FOUND(21, "Service id not found"),
    
    private final Integer errorCode;
    private final String displayPhrase;
}
```

### Exception Throwing Pattern

```java
throw new ProAPIException(
    SearchAPIErrors.SERVICE_NOT_FOUND.getErrorCode(),
    SearchAPIErrors.SERVICE_NOT_FOUND.getDisplayPhrase());
```

**Convention:**
- All error codes prefixed with service name (`javaSearch`)
- Use enums with errorCode and displayPhrase
- Return structured error responses

---

## Testing Requirements

### Test Base Class

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE, classes = WebApplication.class)
@Import(ElasticSearchTestConfig.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@AutoConfigureWireMock(port = 0)
public class BaseTest {
    @Rule 
    public TogglzRule togglzRule = TogglzRule.allEnabled(Features.class);
}
```

### Testing Patterns

- Use `@Nested` + `@TestInstance(Lifecycle.PER_CLASS)` for organization
- Use `@DisplayName` for clear test descriptions
- Mock external services with WireMock
- Use Test Containers for Elasticsearch and RabbitMQ
- Enable all Togglz features during tests

### Test Naming

- Files: `{Entity}Test.java`
- Methods: `test{Scenario}()` or descriptive with `@DisplayName`
- Data: Static resources in `src/test/resources/__files/`

### Integration Test Example

```java
@Test
@DisplayName("nearby listings")
public void nearby() throws Exception {
    CommercialNearbyParams params = new CommercialNearbyParams();
    params.setRadius("10000000");
    params.setPoly("526acdc6c33455e9e4e9");
    params.setP(1);
    params.setResults_per_page(10);

    CommercialResponse response = nearbySearchService.searchV2(params);
    List<CommercialEsDTO> properties = response.getProperties();

    Assertions.assertEquals(282261L, properties.get(0).getId());
}
```

---

## Build & Deployment

### Maven Build Profiles

Available: `staging`, `dev`, `gamma`, `production`, `production-mum`, `nps`, `owner`, `commercial`, `demand`, `supply`, `preprod`

### Build Commands

```bash
# Development build with tests
mvn -Drevision=2.0.0 clean install -P dev

# Staging build with tests
mvn -Drevision=2.0.0 clean install -P staging

# Package only
mvn -Drevision=2.0.0 clean package -P dev
```

### Version Convention

- Format: `X.Y.Z` or `X.Y.Z-<feature-name>` during development
- Remove feature suffix before merging to master

### Docker

```dockerfile
FROM amazoncorretto:21
# Exposes port 8080
# Includes Nginx reverse proxy
# Supports NewRelic APM agent
# Supports Class Data Sharing (CDS) for faster startup
```

### Environment Variables

- `ENV_PROFILE`: Spring profile (staging, prod, etc.)
- `NEWRELIC_ENABLE`: NewRelic APM toggle
- `GC_LOG_DISABLE`: GC logging control

---

## Logging

### Logback Pattern

```xml
<pattern>%d{HH:mm:ss.SSS} [%thread] %-5level %logger{36} 
    - RequestID = %X{global_request_id} - %msg%n</pattern>
```

### Logger Usage

```java
// SLF4J
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

private static final Logger LOGGER = LoggerFactory.getLogger(ClassName.class);
LOGGER.info("es url {}", ES_URL);

// Lombok @Log4j2
@Log4j2
public class MyClass {
    // log object available
    log.info("Processing request");
}
```

**Conventions:**
- Include `global_request_id` in MDC for tracing
- Use INFO level by default
- DEBUG for health checks and diagnostics

---

## Security Requirements

### CORS Configuration

```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedHeaders(Collections.singletonList("*"));
    config.setAllowedOriginPatterns(List.of(
        "https://*.housing.com",
        "https://housing.com",
        "https://timesofindia.indiatimes.com",
        "https://m.timesofindia.com"));
    config.setAllowCredentials(true);
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
    
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}
```

### Security Best Practices

1. **No Hardcoded Credentials**: AWS keys detected by checkstyle
2. **CORS Configuration**: Strict domain whitelisting (`*.housing.com`)
3. **HTTPS Enforcement**: All production origins use HTTPS
4. **CSRF Protection**: Disabled for stateless REST APIs (explicit)
5. **Rate Limiting**: Configured via `rate_limiter_configuration.json`

---

## PR Review Checklist

### Code Style
- [ ] Google Java Format applied
- [ ] Checkstyle passes (`mvn verify`)
- [ ] No hardcoded AWS keys or credentials

### Architecture
- [ ] Correct module placement (core/web/worker)
- [ ] Layered structure followed
- [ ] Library modules have no `<build>` tags in pom.xml

### Naming
- [ ] Classes follow naming conventions
- [ ] Controllers: `{Entity}ControllerV{n}`
- [ ] Services: `{Entity}Service`
- [ ] DTOs: `{Entity}Params`, `{Entity}Response`

### Annotations
- [ ] Lombok annotations used consistently
- [ ] `@NonNull` for null-safety
- [ ] `@DocFilter`/`@Range`/`@DateRange` for filter fields
- [ ] Filter fields use correct types (RangeCriteria, DateRangeCriteria)

### Testing
- [ ] Tests extend BaseTest
- [ ] `@DisplayName` for test clarity
- [ ] WireMock for external services
- [ ] No real external API calls

### Configuration
- [ ] No secrets in code
- [ ] Profile-specific properties used
- [ ] Circuit breaker config for external calls

### Logging
- [ ] SLF4J or @Log4j2 used
- [ ] Request ID in logs
- [ ] No System.out.println

---

## Common Issues

### Issue: Missing Google Java Format

**Detection:**
```
Build fails with checkstyle violations
```

**Solution:**
```bash
java -jar google-java-format.jar -r /path/to/file.java
```

### Issue: Hardcoded AWS Keys

**Detection:**
```
Checkstyle: Hardcoded AWS Key detected
```

**Solution:**
- Move to application.properties
- Use environment variables
- Use AWS Secrets Manager

### Issue: Wrong Filter Annotation Type

**Detection:**
```java
// ❌ BAD - @Range on non-RangeCriteria field
@Range(ctx = FilterContext.PRICE)
private String price;
```

**Solution:**
```java
// ✅ GOOD
@Range(ctx = FilterContext.PRICE)
private RangeCriteria price;
```

### Issue: Missing @NonNull

**Detection:**
```java
// ❌ BAD - No null safety
public O search(final I searchParams) { }
```

**Solution:**
```java
// ✅ GOOD
public O search(@NonNull final I searchParams) { }
```

### Issue: Wrong Module for Code

**Detection:**
- Controller in `core` module
- Shared utility in `web` module

**Solution:**
- Controllers → `web` module
- Shared utilities → `core` or `util` module
- Background jobs → `worker` module

### Issue: System.out.println

**Detection:**
```java
// ❌ BAD
System.out.println("Debug");
```

**Solution:**
```java
// ✅ GOOD
LOGGER.debug("Debug");
// or with Lombok
log.debug("Debug");
```

### Issue: Missing DisplayName in Tests

**Detection:**
```java
// ❌ BAD
@Test
public void test1() { }
```

**Solution:**
```java
// ✅ GOOD
@Test
@DisplayName("should return nearby listings within radius")
public void nearbyListings() { }
```

### Issue: Direct External API Calls in Tests

**Detection:**
```java
// ❌ BAD
@Test
public void testApi() {
    RestTemplate rest = new RestTemplate();
    rest.getForObject("https://real-api.com/...", String.class);
}
```

**Solution:**
```java
// ✅ GOOD - Use WireMock
@AutoConfigureWireMock(port = 0)
public class MyTest extends BaseTest {
    @Test
    public void testApi() {
        stubFor(get("/api").willReturn(ok("{}")));
        // test code
    }
}
```

### Issue: Missing Builder for DTOs

**Detection:**
```java
// ❌ BAD - Manual construction
SearchRequest req = new SearchRequest();
req.setField1(value1);
req.setField2(value2);
```

**Solution:**
```java
// ✅ GOOD - Use builder
SearchRequest req = SearchRequest.builder()
    .field1(value1)
    .field2(value2)
    .build();
```
