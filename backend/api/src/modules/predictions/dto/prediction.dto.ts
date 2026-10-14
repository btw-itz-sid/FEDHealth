import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePredictionDto {
  @ApiProperty({ description: 'Number of pregnancies', example: 6 })
  @IsNumber()
  @Min(0) @Max(20)
  Pregnancies: number;

  @ApiProperty({ description: 'Plasma glucose concentration (mg/dL)', example: 148 })
  @IsNumber()
  @Min(0) @Max(300)
  Glucose: number;

  @ApiProperty({ description: 'Diastolic blood pressure (mm Hg)', example: 72 })
  @IsNumber()
  @Min(0) @Max(200)
  BloodPressure: number;

  @ApiProperty({ description: 'Triceps skin fold thickness (mm)', example: 35 })
  @IsNumber()
  @Min(0) @Max(100)
  SkinThickness: number;

  @ApiProperty({ description: '2-Hour serum insulin (μU/mL)', example: 0 })
  @IsNumber()
  @Min(0) @Max(1000)
  Insulin: number;

  @ApiProperty({ description: 'Body mass index (kg/m²)', example: 33.6 })
  @IsNumber()
  @Min(0) @Max(80)
  BMI: number;

  @ApiProperty({ description: 'Diabetes pedigree function', example: 0.627 })
  @IsNumber()
  @Min(0) @Max(3)
  DiabetesPedigreeFunction: number;

  @ApiProperty({ description: 'Age in years', example: 50 })
  @IsNumber()
  @Min(1) @Max(120)
  Age: number;

  @ApiPropertyOptional({ description: 'Specific model ID to use' })
  @IsOptional()
  @IsString()
  modelId?: string;
}
