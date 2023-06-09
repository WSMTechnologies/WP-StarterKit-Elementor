(function( $, JetMapFieldsSettings ) {

	'use strict';

	class JetEngineMapFields {

		constructor() {
			this.mapProvider = new window.JetEngineMapsProvider();

			this.events();
		}

		events() {
			const self = this;

			self.initFields( $( '.cx-control' ) );

			$( document ).on( 'cx-control-init', function( event, data ) {
				self.initFields( $( data.target ) );
			} );
		}

		initFields( $scope ) {
			const self = this;

			$( '.jet-engine-map-field.cx-ui-container', $scope ).each( function() {

				const $this    = $( this );
				const observer = new IntersectionObserver(
					function( entries, observer ) {

						entries.forEach( function( entry ) {
							if ( entry.isIntersecting ) {
								new JetEngineRenderMapField( $this, self.mapProvider );

								// Detach observer after the first render the map
								observer.unobserve( entry.target );
							}
						} );
					}
				);

				observer.observe( $this[0] );

			} );
		}
	}

	class JetEngineRenderMapField {

		constructor( selector, mapProvider ) {

			this.setup( selector, mapProvider );

			this.render();
			this.events();
		}

		setup( selector, mapProvider ) {
			this.$container = selector;
			this.$input = selector.find( 'input[name]' );
			this.value = this.$input.val();
			this.isRepeaterField = !! this.$input.closest( '.cx-ui-repeater-item-control' ).length;
			this.fieldSettings = Object.assign( {
				height: '300',
				format: 'location_string',
				field_prefix: false,
			}, this.$input.data( 'settings' ) );

			const field_suffix = ! this.isRepeaterField ? '' : '-' + this.$input.closest( '.cx-ui-repeater-item' ).data( 'item-index' );

			this.$inputHash = this.fieldSettings.field_prefix ? $( '#' + this.fieldSettings.field_prefix + '_hash' + field_suffix ) : false;
			this.$inputLat  = this.fieldSettings.field_prefix ? $( '#' + this.fieldSettings.field_prefix + '_lat' + field_suffix ) : false;
			this.$inputLng  = this.fieldSettings.field_prefix ? $( '#' + this.fieldSettings.field_prefix + '_lng' + field_suffix ) : false;

			// Map props.
			this.mapProvider = mapProvider;
			this.map = null;
			this.mapDefaults = {
				center: { lat: 41, lng: 71 },
				zoom: 1,
			};
			this.marker = null;
			this.markerDefaults = {
				content: '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path d="M12 0c-4.198 0-8 3.403-8 7.602 0 4.198 3.469 9.21 8 16.398 4.531-7.188 8-12.2 8-16.398 0-4.199-3.801-7.602-8-7.602zm0 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z" fill="#C92C2C"/></svg>',
				shadow: false,
			};
		}

		render() {
			let template = '<div class="jet-engine-map-field__preview" style="display: none; justify-content: space-between; padding: 0 0 5px; align-items: center;">' +
								'<address class="jet-engine-map-field__position"></address>' +
								'<div class="jet-engine-map-field__reset" role="button" style="cursor: pointer; color: #c92c2c; font-weight: 500; flex-shrink: 0;">× ' + JetMapFieldsSettings.i18n.resetBtn + '</div>' +
							'</div>' +
							'<div class="jet-engine-map-field__frame" style="height: ' + this.fieldSettings.height + 'px"></div>';

			if ( this.isRepeaterField ) {
				template += '<div class="jet-engine-map-field__description">' +
								'<p style="margin-bottom: 0;"><strong>' + JetMapFieldsSettings.i18n.descTitle + ':</strong> <i>' + this.fieldSettings.field_prefix + '_lat, ' + this.fieldSettings.field_prefix +'_lng</i></p>' +
							'</div>';
			}

			this.$container.append( template );

			this.$preview  = this.$container.find( '.jet-engine-map-field__preview' );
			this.$position = this.$container.find( '.jet-engine-map-field__position' );
			this.$mapFrame = this.$container.find( '.jet-engine-map-field__frame' );

			let defaultPos,
				valueFormat = false;

			if ( this.value ) {
				// Set preview from input value.
				try {
					// `location_array` value format
					const jsonValue = JSON.parse( this.value );

					defaultPos = jsonValue;
					this.setPreview( jsonValue );

					valueFormat = 'location_array';

				} catch (e) {

					const valueParts = this.value.split( ',' );

					if ( 2 === valueParts.length && Number( valueParts[0] ) && Number( valueParts[1] ) ) {
						// `location_string` value format
						defaultPos = { lat: Number( valueParts[0] ), lng: Number( valueParts[1] ) };
						this.setPreview( defaultPos );

						valueFormat = 'location_string';

					} else {
						// `location_address` value format
						defaultPos = this.getPositionFromHashFields();
						this.setPreview( this.value );

						valueFormat = 'location_address';
					}
				}

				// Convert value format
				if ( valueFormat !== this.fieldSettings.format ) {
					this.setValue( defaultPos );
				}
			}

			if ( defaultPos ) {
				this.mapDefaults.center = defaultPos;
				this.mapDefaults.zoom = 14;
			}

			this.map = this.mapProvider.initMap( this.$mapFrame[0], this.mapDefaults );

			if ( defaultPos ) {
				this.marker = this.mapProvider.addMarker( Object.assign( this.markerDefaults, {
					position: defaultPos,
					map: this.map,
				} ) );
			}

			this.mapProvider.markerOnClick( this.map, this.markerDefaults, ( marker ) => {

				if ( this.marker ) {
					this.mapProvider.removeMarker( this.marker );
				}

				this.marker = marker;

				let position = this.mapProvider.getMarkerPosition( marker, true );

				this.setValue( position );
			} );
		}

		setValue( position ) {

			let self = this,
				location = '';

			this.setPreview( JetMapFieldsSettings.i18n.loading );

			switch ( this.fieldSettings.format ) {
				case 'location_string':

					location = position.lat + ',' + position.lng;

					this.updateHashFieldPromise( location ).then( function() {
						self.$input.val( location );
						self.setPreview( position );
					} );

					break;

				case 'location_array':

					location = JSON.stringify( position );

					this.updateHashFieldPromise( location ).then( function() {
						self.$input.val( location );
						self.setPreview( position );
					} );

					break;

				case 'location_address':

					wp.apiFetch( {
						method: 'get',
						path: JetMapFieldsSettings.api + '?lat=' + position.lat + '&lng=' + position.lng,
					} ).then( function( response ) {

						if ( response.success ) {

							if ( response.data ) {

								self.updateHashFieldPromise( response.data ).then( function() {
									self.$input.val( response.data );
									self.setPreview( response.data );
								} );

							} else {
								self.$input.val( null );
								self.setPreview( JetMapFieldsSettings.i18n.notFound );
							}

						} else {
							self.$input.val( null );
							self.setPreview( response.html );
						}

					} ).catch( function( e ) {
						console.log( e );
					} );

					break;
			}

			if ( this.$inputLat && this.$inputLng  ) {
				this.$inputLat.val( position.lat );
				this.$inputLng.val( position.lng );
			}
		}

		setPreview( position ) {
			let positionText;

			if ( position && position.lat && position.lng ) {
				positionText = '<span title="Lat">' + position.lat + '</span>, <span title="Lng">' + position.lng + '</span>';
			} else {
				positionText = position;
			}

			this.$position.html( positionText );
			this.$preview.css( 'display', position ? 'flex' : 'none' );
		}

		events() {
			this.$container.on( 'click', '.jet-engine-map-field__reset', this.resetLocation.bind( this ) );
		}

		resetLocation() {
			this.mapProvider.removeMarker( this.marker );
			this.setPreview( null );
			this.$input.val( null );

			if ( this.$inputLat && this.$inputLng  ) {
				this.$inputLat.val( null );
				this.$inputLng.val( null );
			}
		}

		updateHashFieldPromise( location ) {
			let self = this;

			if ( ! this.$inputHash ) {
				return new Promise( function( resolve ) {
					resolve();
				} );
			}

			return wp.apiFetch( {
				method: 'get',
				path: JetMapFieldsSettings.apiHash + '?loc=' + location,
			} ).then( function( response ) {

				if ( response.success ) {
					self.$inputHash.val( response.data );
				}

			} ).catch( function( e ) {
				console.log( e );
			} );
		}

		getPositionFromHashFields() {

			if ( !this.$inputLat || !this.$inputLng  ) {
				return false;
			}

			const lat = this.$inputLat.val(),
				  lng = this.$inputLng.val();

			if ( !lat || !lng ) {
				return false;
			}

			return { lat: Number( lat ), lng: Number( lng ) };
		}

	}

	// Run on document ready.
	$( function () {
		new JetEngineMapFields();
	} );


})( jQuery, window.JetMapFieldsSettings );