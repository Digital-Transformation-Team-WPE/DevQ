using ChecklistMaster.Server.Data;
using ChecklistMaster.Server.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using System.Reflection;
using System.Text;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Allow large payloads (base64 images + reference documents in checklist master)
    builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 52_428_800);

    // Serilog
    builder.Host.UseSerilog((context, services, configuration) =>
        configuration.ReadFrom.Configuration(context.Configuration)
                     .ReadFrom.Services(services)
                     .Enrich.FromLogContext());

    // Entity Framework
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

    // CORS
    var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                         ?? ["https://localhost:52646"];
    builder.Services.AddCors(options =>
        options.AddPolicy("AllowFrontend", policy =>
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials()));

    // Services – CRUD
    builder.Services.AddScoped<IAuthService, AuthService>();
    builder.Services.AddSingleton<IGraphService, GraphService>();
    builder.Services.AddScoped<IUserService, UserService>();
    builder.Services.AddScoped<IProjectService, ProjectService>();
    builder.Services.AddScoped<IProjectIssueLinkService, ProjectIssueLinkService>();
    builder.Services.AddScoped<IIssueListDocinfoService, IssueListDocinfoService>();
    builder.Services.AddScoped<IIssueListPartinfoService, IssueListPartinfoService>();
    builder.Services.AddScoped<IIssueListHistoryService, IssueListHistoryService>();
    builder.Services.AddScoped<IIssueListChecklistService, IssueListChecklistService>();
    builder.Services.AddScoped<IDmrsChecklistService, DmrsChecklistService>();
    builder.Services.AddScoped<IChecklistMasterService, ChecklistMasterService>();
    builder.Services.AddScoped<IComponentMetadataService, ComponentMetadataService>();
    builder.Services.AddScoped<IChecklistMilestoneService, ChecklistMilestoneService>();
    builder.Services.AddScoped<IPartMilestoneService, PartMilestoneService>();
    builder.Services.AddScoped<IProjectMilestoneService, ProjectMilestoneService>();
    builder.Services.AddScoped<ICalendarEventService,   CalendarEventService>();
    builder.Services.AddScoped<IMilestoneMasterService, MilestoneMasterService>();
    builder.Services.AddScoped<IProjectReportService,   ProjectReportService>();
    builder.Services.AddScoped<INotificationService,    NotificationService>();

    builder.Services.AddControllers();

    // ── JWT Bearer ────────────────────────────────────────────────────────────
    var jwtKey = builder.Configuration["Jwt:Key"]
                 ?? throw new InvalidOperationException("Jwt:Key is not configured.");

    builder.Services
        .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(opt =>
        {
            opt.MapInboundClaims = false;
            opt.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer           = true,
                ValidateAudience         = true,
                ValidateLifetime         = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer              = builder.Configuration["Jwt:Issuer"],
                ValidAudience            = builder.Configuration["Jwt:Audience"],
                IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
                ClockSkew                = TimeSpan.Zero,
            };
            // Read JWT from the HttpOnly cookie instead of Authorization header
            opt.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    ctx.Token = ctx.Request.Cookies["cm_auth"];
                    return Task.CompletedTask;
                }
            };
        });

    // Swagger / OpenAPI
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(options =>
    {
        options.SwaggerDoc("v1", new OpenApiInfo
        {
            Title       = "ChecklistMaster API",
            Version     = "v1",
            Description = "REST API for ChecklistMaster – manages Users, Projects, Issue Lists, DMRS Checklists, and Component Metadata.",
            Contact     = new OpenApiContact
            {
                Name  = "ChecklistMaster Team",
                Email = "support@checklistmaster.com"
            },
            License = new OpenApiLicense
            {
                Name = "MIT",
                Url  = new Uri("https://opensource.org/licenses/MIT")
            }
        });

        // Include XML comments from the generated documentation file
        var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
        var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
        if (File.Exists(xmlPath))
            options.IncludeXmlComments(xmlPath);

        // Group endpoints by controller tag
        options.TagActionsBy(api => [api.GroupName ?? api.ActionDescriptor.RouteValues["controller"]!]);
        options.DocInclusionPredicate((_, _) => true);
    });

    var app = builder.Build();

    // ── Database seed (runs only when Users table is empty) ───────────────────
    try
    {
        using var scope  = app.Services.CreateScope();
        var db           = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cfg          = scope.ServiceProvider.GetRequiredService<IConfiguration>();
        var seedLog      = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        await DbSeeder.SeedAsync(db, cfg, seedLog);
    }
    catch (Exception ex)
    {
        // Seeding is non-fatal — app continues running; use /api/auth/bootstrap to add first admin
        Log.Warning(ex, "Startup seeder encountered an unexpected error and was skipped.");
    }

    app.UseSerilogRequestLogging();

    app.UseDefaultFiles();
    app.UseStaticFiles(); // serve all wwwroot files (JS, CSS, images) not just manifest-registered assets

    // Serve dynamically uploaded files from wwwroot/uploads (not in the build-time asset manifest)
    var uploadsRoot = Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "uploads");
    Directory.CreateDirectory(uploadsRoot);

    var mimeProvider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
    mimeProvider.Mappings[".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    mimeProvider.Mappings[".xls"]  = "application/vnd.ms-excel";
    mimeProvider.Mappings[".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    mimeProvider.Mappings[".doc"]  = "application/msword";
    mimeProvider.Mappings[".txt"]  = "text/plain";

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider        = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsRoot),
        RequestPath         = "/uploads",
        ContentTypeProvider = mimeProvider,
    });

    app.MapStaticAssets();

    if (app.Environment.IsDevelopment())
    {
        // Swagger UI at /swagger
        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            options.SwaggerEndpoint("/swagger/v1/swagger.json", "ChecklistMaster API v1");
            options.RoutePrefix        = "swagger";
            options.DocumentTitle      = "ChecklistMaster API";
            options.DisplayRequestDuration();
            options.EnableFilter();
            options.EnableDeepLinking();
            options.DefaultModelsExpandDepth(1);
            options.DefaultModelExpandDepth(2);
        });
    }

    app.UseHttpsRedirection();
    app.UseCors("AllowFrontend");
    app.UseAuthentication();
    app.UseAuthorization();
    app.MapControllers();
    app.MapFallbackToFile("/index.html");

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
