/**
 * Backbone.js Collection Merge Fix Example
 * 
 * This file demonstrates the fix for the error:
 * "TypeError: Object [object Object] has no method 'updateFrom'"
 * 
 * Issue: FORMBRICKS-RN
 * Error occurs when using collection.add() with merge: true on models
 * that don't have an updateFrom method.
 */

// ============================================================================
// PROBLEM: Model without updateFrom method (will cause TypeError)
// ============================================================================

var MemberBroken = Backbone.Model.extend({
    defaults: {
        id: null,
        name: '',
        email: '',
        version: 1
    }
    // Missing updateFrom method - will cause error with merge: true
});

// ============================================================================
// SOLUTION: Model with updateFrom method (fixed)
// ============================================================================

var Member = Backbone.Model.extend({
    defaults: {
        id: null,
        name: '',
        email: '',
        version: 1
    },

    /**
     * Updates this model's attributes from another model instance
     * This method is required when using collection.add with merge: true
     * 
     * @param {Backbone.Model|Object} model - The source model or attributes object
     * @param {Object} options - Options to pass to set() method
     * @return {Backbone.Model} Returns this model for chaining
     */
    updateFrom: function(model, options) {
        if (!model) {
            return this;
        }

        // Extract attributes from model or use object directly
        var attrs = model.attributes ? model.attributes : model;

        // Optionally validate before updating
        if (options && options.validate && !this.isValid(attrs)) {
            return this;
        }

        // Update this model with the new attributes
        this.set(attrs, options);

        return this;
    },

    /**
     * Optional: Validate model attributes
     */
    validate: function(attrs) {
        if (attrs.email && !this.isValidEmail(attrs.email)) {
            return "Invalid email format";
        }
    },

    isValidEmail: function(email) {
        var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
});

// ============================================================================
// Collection Definition
// ============================================================================

var MemberCollection = Backbone.Collection.extend({
    model: Member,

    /**
     * Merge a member into the collection with version checking
     * Only updates if the new version is newer than existing version
     */
    mergeMember: function(member, options) {
        options = options || {};
        
        var existing = this.get(member.id);
        
        // Check if existing version is newer - skip update if so
        if (existing && existing.get('version') > member.get('version')) {
            console.log('Skipping merge: existing version is newer');
            return existing;
        }

        // Add or merge the member
        // This will call updateFrom() if the model exists
        return this.add(member, {
            merge: true,
            sort: options.sort !== false
        });
    }
});

// ============================================================================
// Example View Implementation
// ============================================================================

var MemberListView = Backbone.View.extend({
    initialize: function(options) {
        this.collection = new MemberCollection();
        this.options = options || {};
        this.cursor = null;

        // Listen for collection changes
        this.listenTo(this.collection, 'add', this.onMemberAdded);
        this.listenTo(this.collection, 'change', this.onMemberChanged);
        this.listenTo(this.collection, 'remove', this.onMemberRemoved);
    },

    /**
     * Polling function to fetch updates from server
     * This is the function from the error stack trace
     */
    poll: function() {
        var self = this;
        var data;

        if (!this.options.realtime || !this.options.pollUrl) {
            return window.setTimeout(function() {
                self.poll();
            }, this.options.pollTime);
        }

        data = app.utils.getQueryParams();
        data.cursor = this.cursor || undefined;

        $.ajax({
            url: this.options.pollUrl,
            data: data,
            success: function(response) {
                self.handlePollResponse(response);
            },
            error: function(xhr, status, error) {
                console.error('Poll failed:', error);
            }
        });
    },

    /**
     * Handle poll response and merge new members
     */
    handlePollResponse: function(response) {
        var self = this;
        
        if (response.cursor) {
            this.cursor = response.cursor;
        }

        // Process each member from response
        _.each(response.members, function(memberData) {
            var member = new Member(memberData);
            self.merge(member);
        });
    },

    /**
     * Merge a member into the collection
     * This is the function from the error stack trace (line 268)
     */
    merge: function(member, options) {
        options = options || {};
        
        var existing = this.collection.get(member.id);
        
        // Version check - only update if new version is newer
        if (existing && existing.get('version') > member.get('version')) {
            return;
        }

        // This line caused the original error when updateFrom was missing
        // Now it works because Member model has updateFrom method
        this.collection.add(member, {
            merge: true,
            sort: options.sort !== false ? true : false
        });
    },

    /**
     * Remove a member from collection
     */
    removeMember: function(member) {
        this.collection.remove(member);
    },

    /**
     * Render a member in the container
     * This is the function from the error stack trace (line 283)
     */
    renderMemberInContainer: function(member) {
        var new_pos = this.collection.indexOf(member);
        var $el, $rel;

        this.$parent.find('li.empty').remove();

        $el = $('#' + this.id + member.id);

        if ($el.length) {
            // Update existing element
            $el.replaceWith(this.renderMember(member));
        } else {
            // Insert new element at correct position
            if (new_pos === 0) {
                this.$parent.prepend(this.renderMember(member));
            } else {
                $rel = this.$parent.find('li').eq(new_pos - 1);
                $rel.after(this.renderMember(member));
            }
        }
    },

    renderMember: function(member) {
        return '<li id="' + this.id + member.id + '">' +
               '<span>' + member.get('name') + '</span>' +
               '<span>' + member.get('email') + '</span>' +
               '</li>';
    },

    onMemberAdded: function(member) {
        console.log('Member added:', member.toJSON());
        this.renderMemberInContainer(member);
    },

    onMemberChanged: function(member) {
        console.log('Member changed:', member.toJSON());
        this.renderMemberInContainer(member);
    },

    onMemberRemoved: function(member) {
        $('#' + this.id + member.id).remove();
    }
});

// ============================================================================
// Usage Example
// ============================================================================

// Initialize the view
var memberListView = new MemberListView({
    el: '#member-list',
    realtime: true,
    pollUrl: '/api/members',
    pollTime: 5000
});

// Example: Adding a member
var newMember = new Member({
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    version: 1
});

memberListView.merge(newMember); // Works correctly

// Example: Updating the same member with new version
var updatedMember = new Member({
    id: 1,
    name: 'John Doe',
    email: 'john.doe@example.com',
    version: 2
});

memberListView.merge(updatedMember); // Works correctly - calls updateFrom()

// Example: Trying to update with older version (should be skipped)
var olderMember = new Member({
    id: 1,
    name: 'Old Name',
    email: 'old@example.com',
    version: 1
});

memberListView.merge(olderMember); // Skipped - version is older

// ============================================================================
// Testing the Fix
// ============================================================================

if (typeof describe !== 'undefined') {
    describe('Backbone Collection Merge Fix', function() {
        it('should have updateFrom method on Member model', function() {
            var member = new Member({ id: 1, name: 'Test' });
            expect(member.updateFrom).toBeDefined();
            expect(typeof member.updateFrom).toBe('function');
        });

        it('should update model attributes using updateFrom', function() {
            var member1 = new Member({ id: 1, name: 'John', version: 1 });
            var member2 = new Member({ id: 1, name: 'John Doe', version: 2 });
            
            member1.updateFrom(member2);
            
            expect(member1.get('name')).toBe('John Doe');
            expect(member1.get('version')).toBe(2);
        });

        it('should merge models in collection without error', function() {
            var collection = new MemberCollection([
                { id: 1, name: 'John', email: 'john@test.com', version: 1 }
            ]);
            
            var updatedMember = new Member({ 
                id: 1, 
                name: 'John Doe', 
                email: 'john.doe@test.com',
                version: 2 
            });
            
            expect(function() {
                collection.add(updatedMember, { merge: true });
            }).not.toThrow();
            
            expect(collection.get(1).get('name')).toBe('John Doe');
            expect(collection.get(1).get('email')).toBe('john.doe@test.com');
        });

        it('should respect version checking when merging', function() {
            var collection = new MemberCollection([
                { id: 1, name: 'John Doe', version: 2 }
            ]);
            
            var view = new MemberListView({
                el: $('<div>'),
                realtime: false
            });
            view.collection = collection;
            
            var olderMember = new Member({ id: 1, name: 'Old Name', version: 1 });
            view.merge(olderMember);
            
            // Should still have the newer version
            expect(collection.get(1).get('name')).toBe('John Doe');
            expect(collection.get(1).get('version')).toBe(2);
        });
    });
}

// ============================================================================
// Export for Node.js/CommonJS environments
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Member: Member,
        MemberCollection: MemberCollection,
        MemberListView: MemberListView
    };
}
