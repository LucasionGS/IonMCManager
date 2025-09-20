# IonMC Manager - AI Agent Development Instructions

This document provides comprehensive guidance for AI coding agents working on the IonMC Manager project. Follow these conventions and patterns to ensure consistency and maintainability.

## Project Overview

IonMC Manager is a robust Minecraft server management system built with:
- **Backend**: Deno + Express-like API + Sequelize ORM + Socket.IO
- **Frontend**: React (Vite) + TypeScript + SCSS + Socket.IO Client
- **Database**: MySQL with custom migration system
- **Real-time**: Socket.IO for live updates and server monitoring

### Key Features
- Multi-user Minecraft server management with isolation
- Real-time server control (start/stop/restart/console)
- System monitoring and metrics collection
- Admin panel for user and server limit management
- Responsive dark-themed UI with mobile support

## Architecture Patterns

### Backend Structure

#### 1. Namespace Pattern for Controllers
**CRITICAL**: All controllers MUST use the namespace pattern:

```ts
// Example: server/controllers/ExampleController.ts
import { Router, Request, Response } from "express";
import AuthController from "./AuthController.ts";

interface AuthenticatedRequest extends Request {
  user?: User;
}

namespace ExampleController {
  export const router = Router();
  
  // Routes go here
  router.get('/endpoint', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    // Implementation
  });
}

export default ExampleController;
```

#### 2. API Response Structure
**REQUIRED**: All API responses must follow this structure:

```ts
// Success Response
{
  success: true,
  data?: any,        // Optional data payload
  message?: string   // Optional success message
}

// Error Response
{
  success: false,
  message: string,   // REQUIRED error message
  error?: string     // Optional detailed error info
}
```

#### 3. Authentication Pattern
- Use `AuthController.authenticateToken` middleware for protected routes
- Admin-only routes must check `req.user?.isAdmin`
- Always validate user ownership for user-specific resources

```ts
// Admin check example
if (!user?.isAdmin) {
  return res.status(403).json({
    success: false,
    message: 'Admin access required'
  });
}

// User ownership example
const server = await MinecraftServer.findOne({
  where: { id: serverId, userId: req.user!.id }
});
```

#### 4. Database Models
- Use Sequelize models with static methods for complex queries
- Follow the pattern established in `User.ts`, `MinecraftServer.ts`, `SystemMetrics.ts`
- Add validation methods and helper methods directly to model classes

#### 5. Services Pattern
- Business logic goes in service classes
- Services handle external integrations (Minecraft API, system metrics)
- Always return structured results: `{ success: boolean, message: string, data?: any }`

### Frontend Structure

#### 1. Component Organization
```
src/
  components/     # Reusable UI components
  pages/         # Route-level page components  
  contexts/      # React contexts (Auth, Socket)
  layouts/       # Layout components (AppShell)
  services/      # API service functions
```

#### 2. SCSS Styling Conventions
**CRITICAL**: Follow BEM methodology and dark theme palette:

```scss
.component-name {
  // Base component styles
  color: #ffffff;
  background-color: #1a1a1a;
  
  &__element {
    // Element styles
  }
  
  &__element--modifier {
    // Modified element styles
  }
  
  &--variant {
    // Component variant
  }
}
```

**Required Color Palette**:
- Primary Background: `#1a1a1a`
- Secondary Background: `#2a2a2a`
- Text Primary: `#ffffff`
- Text Secondary: `#cccccc`
- Text Muted: `#999999`
- Accent/Primary: `#007bff`
- Success: `#28a745`
- Warning: `#ffc107`
- Danger: `#dc3545`
- Borders: `#444444`

#### 3. React Patterns
- Use function components with hooks
- Leverage `useAuth()` for authentication state
- Use `useSocket()` for real-time features
- Implement loading states and error handling consistently

#### 4. API Integration
```ts
// Use the minecraftApi service pattern
import { minecraftApi } from '../services/minecraftApi';

// API calls should handle loading and errors
try {
  setLoading(true);
  const response = await minecraftApi.getServers();
  if (response.data.success) {
    setData(response.data.data);
  }
} catch (error) {
  setError('Failed to load data');
} finally {
  setLoading(false);
}
```

### Database and Migrations

#### 1. Migration Pattern
**REQUIRED**: Use the DBMigration class pattern:

```ts
// migrations/YYYY_MM_DD_NNNN_description.ts
import { DataTypes } from "sequelize";
import { DBMigration } from "../migration.ts";

export default new DBMigration({
  async up(queryInterface) {
    await queryInterface.createTable('table_name', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      // Other fields
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE
    });
  }

  async down(queryInterface) {
    await queryInterface.dropTable('table_name');
  }
})
```

#### 2. Model Conventions
- Use TypeScript interfaces for creation attributes
- Implement static methods for complex queries
- Add instance methods for business logic
- Follow established naming: PascalCase for models, camelCase for attributes

### Real-time Features

#### 1. Socket.IO Events
**Server-side emission pattern**:
```ts
import { io } from '../server.ts';

// Emit to specific user
io.to(`user_${userId}`).emit('server_status_update', {
  serverId,
  status: 'running'
});

// Emit to all admin users
io.emit('system_metrics_update', metricsData);
```

**Client-side listening pattern**:
```ts
const { socket } = useSocket();

useEffect(() => {
  if (!socket) return;
  
  const handleUpdate = (data: any) => {
    // Handle update
  };
  
  socket.on('event_name', handleUpdate);
  return () => socket.off('event_name', handleUpdate);
}, [socket]);
```

### File and Directory Management

#### 1. Server File Structure
- Each Minecraft server gets isolated directory under `/tmp/minecraft/servers/`
- Use `ServerSetupService` for file operations
- Always validate file paths and prevent directory traversal

#### 2. Process Management
- Use `ServerControlService` for server process control
- Implement proper cleanup for stopped processes
- Track process states and prevent multiple operations

## Development Workflow

### 1. Adding New Features

1. **Backend First**:
   - Create/update database models and migrations
   - Implement controller endpoints following namespace pattern
   - Add service layer for business logic
   - Test API endpoints

2. **Frontend Second**:
   - Create/update page components with proper SCSS
   - Implement API integration with error handling
   - Add real-time updates if needed
   - Ensure responsive design and dark theme compliance

### 2. Code Quality Standards

#### TypeScript
- Enable strict mode
- Use proper type definitions for all data structures
- Avoid `any` types - create specific interfaces

#### Error Handling
- Always wrap async operations in try-catch
- Return structured error responses
- Log errors with context for debugging
- Implement graceful degradation for non-critical failures

#### Testing
- Test API endpoints with various input scenarios
- Validate authentication and authorization
- Test error conditions and edge cases
- Verify real-time updates work correctly

### 3. Security Considerations

- **Authentication**: JWT tokens with proper validation
- **Authorization**: Role-based access control (admin vs user)
- **Input Validation**: Sanitize all user inputs
- **File Security**: Validate file paths, prevent directory traversal
- **Process Security**: Run servers with appropriate isolation

### 4. Performance Guidelines

- **Database**: Use indexes, limit query results, implement pagination
- **Real-time**: Throttle socket emissions, use rooms for targeted updates
- **Frontend**: Implement loading states, debounce user inputs
- **Memory**: Clean up resources, monitor server processes

## Common Patterns

### 1. Adding New API Endpoints

```ts
// In appropriate controller namespace
router.post('/new-endpoint', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate input
    const { param1, param2 } = req.body;
    if (!param1 || !param2) {
      return res.status(400).json({
        success: false,
        message: 'Required parameters missing'
      });
    }

    // Check authorization if needed
    if (requiresAdmin && !req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Business logic
    const result = await SomeService.performAction(param1, param2);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    // Success response
    res.json({
      success: true,
      data: result.data,
      message: 'Action completed successfully'
    });

  } catch (error) {
    console.error('Error in new-endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
```

### 2. Adding New React Pages

```tsx
// src/pages/NewPage.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { minecraftApi } from '../services/minecraftApi';
import './NewPage.scss';

function NewPage() {
  const { authState } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await minecraftApi.getData();
        if (response.data.success) {
          setData(response.data.data);
        } else {
          setError(response.data.message);
        }
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="new-page">
      <div className="new-page__header">
        <h1>Page Title</h1>
      </div>
      <div className="new-page__content">
        {/* Page content */}
      </div>
    </div>
  );
}

export default NewPage;
```

### 3. Adding New Database Models

```ts
// database/models/NewModel.ts
import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../sequelize.ts';

export interface NewModelAttributes {
  id: number;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewModelCreationAttributes extends Optional<NewModelAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class NewModel extends Model<NewModelAttributes, NewModelCreationAttributes> implements NewModelAttributes {
  public id!: number;
  public name!: string;
  public description!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Static methods for queries
  static async findByName(name: string): Promise<NewModel | null> {
    return await NewModel.findOne({ where: { name } });
  }

  // Instance methods
  public async performAction(): Promise<boolean> {
    // Implementation
    return true;
  }
}

NewModel.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  }
}, {
  sequelize,
  modelName: 'NewModel',
  tableName: 'new_models',
  timestamps: true,
});

export default NewModel;
```

## Integration Points

### 1. Adding to API Router
Register new controllers in `controllers/ApiController.ts`:

```ts
router.use("/new-feature", NewController.router);
```

### 2. Adding to Frontend Routes
Add routes in `App.tsx`:

```tsx
<Route path="/new-feature" element={<NewFeaturePage />} />
```

### 3. Navigation Updates
Update `components/Sidebar.tsx` for new navigation items.

## Troubleshooting Common Issues

### 1. Database Connection
- Check Sequelize connection in `database/sequelize.ts`
- Verify environment variables are set correctly
- Run migrations: `deno task migrate`

### 2. Authentication Issues
- Verify JWT secret is configured
- Check token expiration and refresh logic
- Validate user permissions in middleware

### 3. Socket.IO Problems
- Ensure client connects after authentication
- Check CORS configuration for Socket.IO
- Verify room joining for user-specific events

### 4. File System Permissions
- Ensure proper permissions for server directories
- Check Docker volume mounts in development
- Validate file path security

## Environment and Deployment

### Development Setup
```bash
# Backend (Deno)
cd server
deno task dev

# Frontend (Node.js)
cd client  
npm run dev

# Database (Docker)
docker-compose -f docker-compose.dev.yml up -d
```

### Environment Variables
```env
# Server
JWT_SECRET=your-secret-key
CLIENT_URL=http://localhost:5173
INTERNAL_PORT=3174

# Client
CLIENT_PORT=5173
```

### Key Commands
- `deno task migrate` - Run database migrations
- `deno task rollback` - Rollback last migration
- `npm run build` - Build frontend for production
- `deno task dev` - Start development server

## Final Notes

- **Always follow established patterns** - Don't introduce new architectural patterns without discussion
- **Test thoroughly** - Especially authentication, file operations, and real-time features
- **Document breaking changes** - Update this file if you modify core patterns
- **Security first** - Validate inputs, check permissions, sanitize outputs
- **Mobile responsive** - All UI must work on mobile devices
- **Dark theme compliance** - Follow the established color palette

When in doubt, refer to existing implementations in the codebase for guidance. The patterns established in `AuthController.ts`, `ServerController.ts`, `MonitoringController.ts`, and their corresponding frontend pages serve as the canonical examples.