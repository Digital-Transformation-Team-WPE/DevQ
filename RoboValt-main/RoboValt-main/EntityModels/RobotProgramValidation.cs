using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;

namespace Robot_Program_Validation.EntityModels;

public partial class RobotProgramValidation
{  
    public int? SNo { get; set; }

    public string? Standard { get; set; }

    public string? Document { get; set; }

    public string? Item { get; set; }

    public string? Wordings { get; set; }

    public string? FilesToCheck { get; set; }

    public string? HowToCheck { get; set; }

    public string? OutputOfTheItem { get; set; }

    public string? WhatToCheck { get; set; }

    public string? WhatToValidate { get; set; }

    public string? Status { get; set; }

    public string? ModifiedBy { get; set; }

    public string? ValidationSummary { get; set; }
    
}
