# My Chrome Extension

This Chrome extension extracts and displays all HTTP hyperlinks from the current web page in a popup interface.

## Project Structure

- **manifest.json**: Configuration file for the Chrome extension.
- **popup.html**: HTML structure for the extension's popup interface.
- **scripts/**: Contains the JavaScript files for background processing and content manipulation.
  - **background.js**: Background script for managing events.
  - **content.js**: Content script for extracting HTTP hyperlinks from the current page.
  - **popup.js**: Logic for displaying hyperlinks in the popup.
- **icons/**: Directory for extension icons.
- **README.md**: Documentation for the project.

## Installation

1. Download or clone the repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top right corner.
4. Click on "Load unpacked" and select the project directory.

## Usage

1. Navigate to any web page with HTTP hyperlinks.
2. Click on the extension icon in the Chrome toolbar.
3. The popup will display all extracted HTTP hyperlinks.

## License

This project is licensed under the MIT License.