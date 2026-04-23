import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class RetryConfigDto {
  @IsInt()
  @Min(0)
  max_attempts: number;

  @IsInt()
  @Min(0)
  backoff_ms: number;
}

class NodeDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(['http', 'delay', 'condition', 'script'])
  type: string;

  @IsObject()
  config: Record<string, any>;

  @IsOptional()
  @ValidateNested()
  @Type(() => RetryConfigDto)
  retry?: RetryConfigDto;
}

class EdgeDto {
  @IsString()
  from: string;

  @IsString()
  to: string;
}

class DefinitionDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(1000)
  timeout_ms: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeDto)
  nodes: NodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EdgeDto)
  edges: EdgeDto[];
}

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'ARCHIVED'])
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

  @ValidateNested()
  @Type(() => DefinitionDto)
  definition: DefinitionDto;
}