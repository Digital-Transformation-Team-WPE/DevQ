using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;

namespace Robot_Program_Validation.EntityModels;

public partial class RobotProgramValidationContext : DbContext
{
    public RobotProgramValidationContext()
    {
    }

    public RobotProgramValidationContext(DbContextOptions<RobotProgramValidationContext> options)
        : base(options)
    {
    }

    public virtual DbSet<EmployeeTable> EmployeeTables { get; set; }

    public virtual DbSet<RobotProgramValidation> RobotProgramValidations { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=Robot Program Validation;Trusted_Connection=True;TrustServerCertificate=True");
    }

    //    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    //#warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see https://go.microsoft.com/fwlink/?LinkId=723263.
    //      => optionsBuilder.UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=Robot Program Validation;Trusted_Connection=True;TrustServerCertificate=True");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<EmployeeTable>(entity =>
        {
            entity.HasKey(e => e.Id).HasName("PK__Employee__3214EC07AAFBDB12");

            entity.ToTable("EmployeeTable");

            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.EmployeeId).IsUnicode(false);
            entity.Property(e => e.Name).IsUnicode(false);
            entity.Property(e => e.Role).IsUnicode(false);
            entity.Property(e => e.Status).IsUnicode(false);
            
        });

        modelBuilder.Entity<RobotProgramValidation>(entity =>
        {
            entity
                .HasNoKey()
                .ToTable("Robot Program Validation");

            entity.Property(e => e.Document)
                .IsUnicode(false)
                .HasDefaultValueSql("(NULL)");
            entity.Property(e => e.FilesToCheck)
                .IsUnicode(false)
                .HasDefaultValueSql("(NULL)")
                .HasColumnName("Files to check");
            entity.Property(e => e.HowToCheck)
                .IsUnicode(false)
                .HasDefaultValueSql("(NULL)")
                .HasColumnName("How to check");
            entity.Property(e => e.Item)
                .IsUnicode(false)
                .HasDefaultValueSql("(NULL)");
            entity.Property(e => e.ModifiedBy)
                .HasMaxLength(10)
                .HasDefaultValueSql("(NULL)")
                .IsFixedLength()
                .HasColumnName("Modified by");
            entity.Property(e => e.OutputOfTheItem)
                .IsUnicode(false)
                .HasDefaultValueSql("(NULL)")
                .HasColumnName("Output of the Item");
            entity.Property(e => e.SNo)
                .HasDefaultValueSql("(NULL)")
                .HasColumnName("S.NO");
            entity.Property(e => e.Standard)
                .IsUnicode(false)
                .HasDefaultValueSql("(NULL)")
                .HasColumnName("Standard ");
            entity.Property(e => e.Status)
                .HasMaxLength(50)
                .HasDefaultValueSql("(NULL)");
            entity.Property(e => e.WhatToCheck)
                .HasMaxLength(50)
                .HasDefaultValueSql("(NULL)")
                .HasColumnName("What to Check");
            entity.Property(e => e.WhatToValidate)
                .HasMaxLength(50)
                .HasDefaultValueSql("(NULL)")
                .HasColumnName("What to Validate ");
            entity.Property(e => e.Wordings)
                .IsUnicode(false)
                .HasDefaultValueSql("(NULL)");
            entity.Property(e => e.ValidationSummary)
                .HasMaxLength(1000)
                .IsUnicode(true)
                .HasDefaultValueSql("(NULL)");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
