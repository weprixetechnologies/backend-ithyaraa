const model = require('../model/homepageSectionsModel');

/**
 * Create a new homepage section
 */
const createSectionService = async (sectionData) => {
    try {
        // Validate required fields
        if (!sectionData.image) {
            return {
                success: false,
                message: 'Image is required'
            };
        }

        // Validate filters if provided (should be an object)
        if (sectionData.filters && typeof sectionData.filters !== 'object') {
            return {
                success: false,
                message: 'Filters must be a valid JSON object'
            };
        }

        // Set default position if not provided
        if (sectionData.position === undefined || sectionData.position === null) {
            // Get max position and add 1
            const allSections = await model.getAllSections({ page: 1, limit: 1000 });
            if (allSections.success) {
                const maxPosition = allSections.data.length > 0
                    ? Math.max(...allSections.data.map(s => s.position || 0))
                    : 0;
                sectionData.position = maxPosition + 1;
            } else {
                sectionData.position = 1;
            }
        }

        // Default isActive to true if not provided
        if (sectionData.isActive === undefined) {
            sectionData.isActive = true;
        }

        // Construct fallbackLink: FRONTEND_URL/routeTo?filters
        let fallbackLink = null;
        if (sectionData.routeTo) {
            const frontendUrl = process.env.FRONTEND_URL || '';
            const baseUrl = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl;
            const routePath = sectionData.routeTo.startsWith('/') ? sectionData.routeTo : `/${sectionData.routeTo}`;

            if (sectionData.filters && Object.keys(sectionData.filters).length > 0) {
                const queryParams = new URLSearchParams();
                Object.entries(sectionData.filters).forEach(([key, value]) => {
                    if (value !== null && value !== undefined && value !== '') {
                        queryParams.append(key, String(value));
                    }
                });
                const queryString = queryParams.toString();
                fallbackLink = queryString ? `${baseUrl}${routePath}?${queryString}` : `${baseUrl}${routePath}`;
            } else {
                fallbackLink = `${baseUrl}${routePath}`;
            }
        }
        sectionData.fallbackLink = fallbackLink;

        const result = await model.createSection(sectionData);

        if (!result.success) {
            return {
                success: false,
                message: 'Failed to create section',
                error: result.error
            };
        }

        // Fetch the created section to return
        const createdSection = await model.getSectionByID(result.id);
        if (!createdSection.success) {
            return {
                success: true,
                message: 'Section created successfully',
                data: { id: result.id }
            };
        }

        return {
            success: true,
            message: 'Section created successfully',
            data: createdSection.data
        };
    } catch (error) {
        console.error('Error in createSectionService:', error);
        return {
            success: false,
            message: 'Internal server error',
            error: error.message
        };
    }
};

/**
 * Get all sections with pagination (Admin)
 */
const getAllSectionsService = async (queryParams = {}) => {
    try {
        const page = parseInt(queryParams.page) || 1;
        const limit = parseInt(queryParams.limit) || 10;
        const sortBy = queryParams.sortBy || 'position';
        const sortDir = queryParams.sortDir || 'ASC';

        const result = await model.getAllSections({ page, limit, sortBy, sortDir });

        if (!result.success) {
            return {
                success: false,
                message: 'Failed to fetch sections',
                error: result.error
            };
        }

        return {
            success: true,
            message: 'Sections retrieved successfully',
            data: result.data,
            pagination: {
                currentPage: result.page,
                totalItems: result.total,
                totalPages: result.totalPages,
                limit: result.limit
            }
        };
    } catch (error) {
        console.error('Error in getAllSectionsService:', error);
        return {
            success: false,
            message: 'Internal server error',
            error: error.message
        };
    }
};

/**
 * Get active sections (Frontend)
 */
const getActiveSectionsService = async () => {
    try {
        const result = await model.getActiveSections();

        if (!result.success) {
            return {
                success: false,
                message: 'Failed to fetch active sections',
                error: result.error
            };
        }

        return {
            success: true,
            message: 'Active sections retrieved successfully',
            data: result.data
        };
    } catch (error) {
        console.error('Error in getActiveSectionsService:', error);
        return {
            success: false,
            message: 'Internal server error',
            error: error.message
        };
    }
};

/**
 * Get section by ID
 */
const getSectionByIDService = async (id) => {
    try {
        if (!id) {
            return {
                success: false,
                message: 'Section ID is required'
            };
        }

        const result = await model.getSectionByID(id);

        if (!result.success) {
            return {
                success: false,
                message: result.message || 'Section not found',
                error: result.error
            };
        }

        return {
            success: true,
            message: 'Section retrieved successfully',
            data: result.data
        };
    } catch (error) {
        console.error('Error in getSectionByIDService:', error);
        return {
            success: false,
            message: 'Internal server error',
            error: error.message
        };
    }
};

/**
 * Update section
 */
const updateSectionService = async (id, sectionData) => {
    try {
        if (!id) {
            return {
                success: false,
                message: 'Section ID is required'
            };
        }

        // Validate filters if provided
        if (sectionData.filters !== undefined && sectionData.filters !== null) {
            if (typeof sectionData.filters !== 'object') {
                return {
                    success: false,
                    message: 'Filters must be a valid JSON object'
                };
            }
        }

        // Check if section exists
        const existingSection = await model.getSectionByID(id);
        if (!existingSection.success) {
            return {
                success: false,
                message: 'Section not found'
            };
        }

        // Construct fallbackLink if routeTo or filters are being updated
        if (sectionData.routeTo !== undefined || sectionData.filters !== undefined) {
            const currentData = existingSection.data;
            const routeTo = sectionData.routeTo !== undefined ? sectionData.routeTo : currentData.routeTo;
            const filters = sectionData.filters !== undefined ? sectionData.filters : (currentData.filters || {});

            if (routeTo) {
                const frontendUrl = process.env.FRONTEND_URL || '';
                const baseUrl = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl;
                const routePath = routeTo.startsWith('/') ? routeTo : `/${routeTo}`;

                if (filters && Object.keys(filters).length > 0) {
                    const queryParams = new URLSearchParams();
                    Object.entries(filters).forEach(([key, value]) => {
                        if (value !== null && value !== undefined && value !== '') {
                            queryParams.append(key, String(value));
                        }
                    });
                    const queryString = queryParams.toString();
                    sectionData.fallbackLink = queryString ? `${baseUrl}${routePath}?${queryString}` : `${baseUrl}${routePath}`;
                } else {
                    sectionData.fallbackLink = `${baseUrl}${routePath}`;
                }
            }
        }

        const result = await model.updateSection(id, sectionData);

        if (!result.success) {
            return {
                success: false,
                message: result.message || 'Failed to update section',
                error: result.error
            };
        }

        // Fetch updated section
        const updatedSection = await model.getSectionByID(id);
        return {
            success: true,
            message: result.message || 'Section updated successfully',
            data: updatedSection.success ? updatedSection.data : null
        };
    } catch (error) {
        console.error('Error in updateSectionService:', error);
        return {
            success: false,
            message: 'Internal server error',
            error: error.message
        };
    }
};

/**
 * Delete section
 */
const deleteSectionService = async (id) => {
    try {
        if (!id) {
            return {
                success: false,
                message: 'Section ID is required'
            };
        }

        // Check if section exists
        const existingSection = await model.getSectionByID(id);
        if (!existingSection.success) {
            return {
                success: false,
                message: 'Section not found'
            };
        }

        const result = await model.deleteSection(id);

        if (!result.success) {
            return {
                success: false,
                message: result.message || 'Failed to delete section',
                error: result.error
            };
        }

        return {
            success: true,
            message: result.message || 'Section deleted successfully'
        };
    } catch (error) {
        console.error('Error in deleteSectionService:', error);
        return {
            success: false,
            message: 'Internal server error',
            error: error.message
        };
    }
};

/**
 * Update section status (enable/disable)
 */
const updateSectionStatusService = async (id, isActive) => {
    try {
        if (!id) {
            return {
                success: false,
                message: 'Section ID is required'
            };
        }

        if (typeof isActive !== 'boolean') {
            return {
                success: false,
                message: 'isActive must be a boolean value'
            };
        }

        // Check if section exists
        const existingSection = await model.getSectionByID(id);
        if (!existingSection.success) {
            return {
                success: false,
                message: 'Section not found'
            };
        }

        const result = await model.updateSectionStatus(id, isActive);

        if (!result.success) {
            return {
                success: false,
                message: result.message || 'Failed to update section status',
                error: result.error
            };
        }

        // Fetch updated section
        const updatedSection = await model.getSectionByID(id);
        return {
            success: true,
            message: result.message || `Section ${isActive ? 'enabled' : 'disabled'} successfully`,
            data: updatedSection.success ? updatedSection.data : null
        };
    } catch (error) {
        console.error('Error in updateSectionStatusService:', error);
        return {
            success: false,
            message: 'Internal server error',
            error: error.message
        };
    }
};

module.exports = {
    createSectionService,
    getAllSectionsService,
    getActiveSectionsService,
    getSectionByIDService,
    updateSectionService,
    deleteSectionService,
    updateSectionStatusService
};
