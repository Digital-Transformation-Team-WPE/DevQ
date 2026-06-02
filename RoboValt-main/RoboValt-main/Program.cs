using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.Graph;
using Robot_Program_Validation.EntityModels;
using Robot_Program_Validation.Services;

var builder = WebApplication.CreateBuilder(args);

// MVC
builder.Services.AddControllersWithViews();

// EF DbContext
builder.Services.AddDbContext<RobotProgramValidationContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Session
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

// Graph Options
builder.Services.Configure<GraphOptions>(builder.Configuration.GetSection("Graph"));

// Graph Client
builder.Services.AddSingleton<GraphServiceClient>(sp =>
{
    var opts = sp.GetRequiredService<IOptions<GraphOptions>>().Value;
    return AppGraphClientFactory.Create(opts.TenantId!, opts.ClientId!, opts.ClientSecret!);
});

// Graph Directory Service
builder.Services.AddScoped<IGraphDirectoryService, GraphDirectoryService>();

// Robot Validation ML Service (with connection string injection)
builder.Services.AddScoped<RobotValidationMLService>(sp =>
    new RobotValidationMLService(
        sp.GetRequiredService<IWebHostEnvironment>(),
        builder.Configuration));

var app = builder.Build();

// Pipeline
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();
app.UseSession();

// DEFAULT ROUTE → LOGIN
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Login}/{action=Loginpage}/{id?}"
);

app.Run();