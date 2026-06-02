using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;

namespace Robot_Program_Validation.EntityModels;
public partial class EmployeeTable
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public string? EmployeeId { get; set; }
    public string? Role { get; set; }
    public string? Status { get; set; }
}


