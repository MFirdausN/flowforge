import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ContentReviewDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  excerpt?: string;

  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  content: string;
}
