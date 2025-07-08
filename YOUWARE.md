# YOUWARE Project Documentation

## Project Overview

This is a web-based management system for materials and inventory control, featuring multiple modules for different business processes. The project uses HTML, CSS, JavaScript, and Firebase for backend operations.

## Architecture & File Structure

### Core Pages
- **`index.html`** - Main dashboard/entry point
- **`analise-estoque.html`** - Inventory analysis module
- **`gestao-compras.html`** - Purchase management module  
- **`recebimento.html`** - Receiving/intake module
- **`empenho.html`** - Material commitment/allocation module
- **`code-viewer.html`** - Code viewing utility

### JavaScript Structure
- **`js/empenho.js`** - Complete material commitment system implementation
  - Class-based architecture with `SistemaEmpenho`
  - Firebase integration for real-time data operations
  - Batch transaction handling for data consistency
  - Memory-based filtering for performance optimization

### Styling
- Each HTML page contains embedded CSS in `<style>` tags
- Responsive design patterns throughout
- Custom CSS variables and component-based styling
- Modern UI with gradients, animations, and toast notifications

## Firebase Integration

### Database Structure
The system expects specific Firestore collections:

- **`pedidos`** (Orders) - Contains client orders with status tracking
- **`itens`** (Items) - Individual items linked to orders with inventory tracking
- Each item includes `historicoEmpenhos` and `historicoRecebimentos` arrays for audit trails

### Key Firebase Patterns
- **Data Enrichment**: Items are enriched with parent order data for efficient filtering
- **Batch Transactions**: All write operations use Firebase batch for atomicity
- **Optimistic Loading**: Load all data once, filter in memory for responsive UX
- **Status Cascading**: Item status updates trigger order status recalculation

## Key Implementation Patterns

### Cascade Filtering System
The project implements a three-level cascade filter pattern:
1. **Cliente** (Client) → populates on init
2. **Projeto** (Project) → enabled after client selection
3. **Lista de Material** (Material List) → enabled after project selection

This pattern is reusable across modules and provides consistent UX.

### State Management
- Uses JavaScript Maps for O(1) data access
- Maintains enriched data arrays to avoid repeated Firebase queries
- Implements Set data structures for tracking selections

### Error Handling & User Feedback
- Toast notification system for user feedback
- Comprehensive error catching with console logging
- Loading states for all async operations
- Input validation with real-time feedback

## Development Guidelines

### Firebase Configuration
Each page requiring Firebase includes configuration in a script block. Update the config object with your Firebase project credentials:

```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    // ... other config
};
```

### Adding New Modules
When creating new modules:
1. Follow the existing HTML structure with embedded CSS
2. Use Firebase compat library version 9.0.0
3. Implement class-based JavaScript architecture
4. Include toast notification system
5. Add proper error handling and loading states

### Code Organization
- Keep CSS embedded in HTML files for module independence
- Use semantic HTML structure
- Implement responsive design from the start
- Follow established naming conventions for classes and IDs

### Performance Considerations
- Load data once, filter in memory for responsive interactions
- Use batch operations for multiple Firebase writes
- Implement proper loading states to improve perceived performance
- Consider data pagination for large datasets (not currently implemented)

## Testing & Debugging

### Console Logging
The system includes comprehensive console logging for debugging:
- Data loading progress
- Filter state changes  
- Transaction details
- Error conditions

### Firebase Rules
Ensure Firestore security rules allow authenticated access to the required collections. The system expects read/write access to `pedidos` and `itens` collections.

### Browser Compatibility
- Requires modern browser with ES6+ support
- Uses Firebase v9 compat mode for stability
- Responsive design works on mobile and desktop

## Common Development Tasks

### Extending Tables
To add columns to existing tables:
1. Update HTML table structure in the respective page
2. Modify the corresponding `criarLinha*` function in JavaScript
3. Update any modal tables if applicable

### Adding New Filters
Follow the cascade pattern established in the empenho module:
1. Add select element to HTML
2. Implement `onXChange()` handler
3. Update `populateXFilter()` function
4. Reset subsequent filters appropriately

### Firebase Integration
For new Firebase operations:
1. Use batch transactions for multiple writes
2. Include error handling with user feedback
3. Update local state after successful operations
4. Consider impact on related data (cascading updates)

---

**Note**: This project follows a modular approach where each page is self-contained with its own styles and scripts. This allows for independent development and deployment of features while maintaining consistency through shared patterns and conventions.