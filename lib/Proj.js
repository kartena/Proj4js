/*
Author:       Mike Adair madairATdmsolutions.ca
              Richard Greenwood rich@greenwoodmap.com
              Mattias Bengtsson mattias.bengtsson@kartena.se
License:      MIT as per: ../LICENSE
*/

/**
 * Class: Proj4js.Proj
 *
 * Proj objects provide transformation methods for point coordinates
 * between geodetic latitude/longitude and a projected coordinate system.
 * once they have been initialized with a projection code.
 *
 * Initialization of Proj objects is with a projection code, usually EPSG codes,
 * which is the key that will be used with the Proj4js.defs array.
 *
 * The code passed in will be stripped of colons and converted to uppercase
 * to locate projection definition files.
 *
 * A projection object has properties for units and title strings.
 */
Proj4js.Proj = Proj4js.Class({

	/**
	 * Property: title
	 * The title to describe the projection
	 */
	title: null,

	/**
	 * Property: projName
	 * The projection class for this projection, e.g. lcc (lambert conformal conic,
	 * or merc for mercator).  These are exactly equivalent to their Proj4
	 * counterparts.
	 */
	projName: null,
	/**
	 * Property: units
	 * The units of the projection.  Values include 'm' and 'degrees'
	 */
	units: null,
	/**
	 * Property: datum
	 * The datum specified for the projection
	 */
	datum: null,
	/**
	 * Property: x0
	 * The x coordinate origin
	 */
	x0: 0,
	/**
	 * Property: y0
	 * The y coordinate origin
	 */
	y0: 0,
	/**
	 * Property: localCS
	 * Flag to indicate if the projection is a local one in which no transforms
	 * are required.
	 */
	localCS: false,

	/**
	 * Constructor: initialize
	 * Constructor for Proj4js.Proj objects
	 *
	 * Parameters:
	 * srsCode - a code for map projection definition parameters.  These are usually
	 * (but not always) EPSG codes.
	 */
	initialize: function(srsCode, proj4) {

		//check to see if this is a WKT string
		if ((srsCode.indexOf('GEOGCS') >= 0) ||
			(srsCode.indexOf('GEOCCS') >= 0) ||
			(srsCode.indexOf('PROJCS') >= 0) ||
			(srsCode.indexOf('LOCAL_CS') >= 0)) {
            this.parseWKT(srsCode);
            this.deriveConstants();
            this.loadProjCode(this.projName);
            return;
		}

		this.srsCode = srsCode.toUpperCase();
		if (this.srsCode.indexOf("EPSG") == 0) {
			this.srsCode = this.srsCode;
			this.srsAuth = 'epsg';
			this.srsProjNumber = this.srsCode.substring(5);
			// DGR 2007-11-20 : authority IGNF
		} else if (this.srsCode.indexOf("IGNF") == 0) {
			this.srsCode = this.srsCode;
			this.srsAuth = 'IGNF';
			this.srsProjNumber = this.srsCode.substring(5);
			// DGR 2008-06-19 : pseudo-authority CRS for WMS
		} else if (this.srsCode.indexOf("CRS") == 0) {
			this.srsCode = this.srsCode;
			this.srsAuth = 'CRS';
			this.srsProjNumber = this.srsCode.substring(4);
		} else {
			this.srsAuth = '';
			this.srsProjNumber = this.srsCode;
		}

		this.loadProjDefinition(proj4);
	},


	/**
	 * Function: defsLoaded
	 * Continues the Proj object initilization once the def file is loaded
	 *
	 */
    loadProjDefinition: function(proj4) {
		this.parseDefs(proj4);
		this.loadProjCode(this.projName);
    },

	/**
	 * Function: loadProjCode
	 *    Loads projection class code dynamically if required.
	 *     Projection code may be included either through a script tag or in
	 *     a built version of proj4js
	 *
	 */
    loadProjCode: function(projName) {
		if (Proj4js.Proj[projName]) {
			this.initTransforms();
			return;
		} else {
			Proj4js.reportError("loadProjCode: projCode for '"
								+ projName
								+ "' doesn't exist. Did you forget to load it?");

		}
    },


	/**
	 * Function: initTransforms
	 *    Finalize the initialization of the Proj object
	 *
	 */
    initTransforms: function() {
		Proj4js.extend(this, Proj4js.Proj[this.projName]);
		this.init();
	},

	/**
	 * Function: parseWKT
	 * Parses a WKT string to get initialization parameters
	 *
	 */
	wktRE: /^(\w+)\[(.*)\]$/,
	parseWKT: function(wkt) {
		var wktMatch = wkt.match(this.wktRE);
		if (!wktMatch) return;
		var wktObject = wktMatch[1];
		var wktContent = wktMatch[2];
		var wktTemp = wktContent.split(",");
		var wktName;
		if (wktObject.toUpperCase() == "TOWGS84") {
			wktName = wktObject;  //no name supplied for the TOWGS84 array
		} else {
			wktName = wktTemp.shift();
		}
		wktName = wktName.replace(/^\"/,"");
		wktName = wktName.replace(/\"$/,"");

		var wktArray = new Array();
		var bkCount = 0;
		var obj = "";
		for (var i=0; i<wktTemp.length; ++i) {
			var token = wktTemp[i];
			for (var j=0; j<token.length; ++j) {
				if (token.charAt(j) == "[") ++bkCount;
				if (token.charAt(j) == "]") --bkCount;
			}
			obj += token;
			if (bkCount === 0) {
				wktArray.push(obj);
				obj = "";
			} else {
				obj += ",";
			}
		}

		//do something based on the type of the wktObject being parsed
		//add in variations in the spelling as required
		switch (wktObject) {
		case 'LOCAL_CS':
			this.projName = 'identity';
			this.localCS = true;
			this.srsCode = wktName;
			break;
		case 'GEOGCS':
			this.projName = 'longlat';
			this.geocsCode = wktName;
			if (!this.srsCode) this.srsCode = wktName;
			break;
		case 'PROJCS':
			this.srsCode = wktName;
			break;
		case 'GEOCCS':
			break;
		case 'PROJECTION':
			this.projName = Proj4js.Proj.wktProjections[wktName];
			break;
		case 'DATUM':
			this.datumName = wktName;
			break;
		case 'LOCAL_DATUM':
			this.datumCode = 'none';
			break;
		case 'SPHEROID':
			this.ellps = wktName;
			this.a = parseFloat(wktArray.shift());
			this.rf = parseFloat(wktArray.shift());
			break;
		case 'PRIMEM':
			this.from_greenwich = parseFloat(wktArray.shift()); //to radians?
			break;
		case 'UNIT':
			this.units = wktName;
			this.unitsPerMeter = parseFloat(wktArray.shift());
			break;
		case 'PARAMETER':
			var name = wktName.toLowerCase();
			var value = parseFloat(wktArray.shift());
			//there may be many variations on the wktName values, add in case
			//statements as required
			switch (name) {
			case 'false_easting':
				this.x0 = value;
				break;
			case 'false_northing':
				this.y0 = value;
				break;
			case 'scale_factor':
				this.k0 = value;
				break;
			case 'central_meridian':
				this.long0 = value*Proj4js.common.D2R;
				break;
			case 'latitude_of_origin':
				this.lat0 = value*Proj4js.common.D2R;
				break;
			case 'more_here':
				break;
			default:
				break;
			}
			break;
		case 'TOWGS84':
			this.datum_params = wktArray;
			break;
			//DGR 2010-11-12: AXIS
		case 'AXIS':
			var name= wktName.toLowerCase();
			var value= wktArray.shift();
			switch (value) {
			case 'EAST' : value= 'e'; break;
			case 'WEST' : value= 'w'; break;
			case 'NORTH': value= 'n'; break;
			case 'SOUTH': value= 's'; break;
			case 'UP'   : value= 'u'; break;
			case 'DOWN' : value= 'd'; break;
			case 'OTHER':
			default     : value= ' '; break;//FIXME
			}
			if (!this.axis) { this.axis= "enu"; }
			switch(name) {
			case 'x': this.axis=                         value + this.axis.substr(1,2); break;
			case 'y': this.axis= this.axis.substr(0,1) + value + this.axis.substr(2,1); break;
			case 'z': this.axis= this.axis.substr(0,2) + value                        ; break;
			default : break;
			}
		case 'MORE_HERE':
			break;
		default:
			break;
		}
		for (var i=0; i<wktArray.length; ++i) {
			this.parseWKT(wktArray[i]);
		}
	},

	/**
	 * Function: parseDefs
	 * Parses the PROJ.4 initialization string and sets the associated properties.
	 *
	 */
	parseDefs: function(proj4) {
		var paramArray=proj4.split("+");

		for (var prop=0; prop<paramArray.length; prop++) {
			var property = paramArray[prop].split("=");
			paramName = property[0].toLowerCase();
			paramVal = property[1];

			switch (paramName.replace(/\s/gi,"")) {  // trim out spaces
            case "": break;   // throw away nameless parameter
            case "title":  this.title = paramVal; break;
            case "proj":   this.projName =  paramVal.replace(/\s/gi,""); break;
            case "units":  this.units = paramVal.replace(/\s/gi,""); break;
            case "datum":  this.datumCode = paramVal.replace(/\s/gi,""); break;
            case "nadgrids": this.nagrids = paramVal.replace(/\s/gi,""); break;
            case "ellps":  this.ellps = paramVal.replace(/\s/gi,""); break;
            case "a":      this.a =  parseFloat(paramVal); break;  // semi-major radius
            case "b":      this.b =  parseFloat(paramVal); break;  // semi-minor radius
				// DGR 2007-11-20
            case "rf":     this.rf = parseFloat(paramVal); break; // inverse flattening rf= a/(a-b)
            case "lat_0":  this.lat0 = paramVal*Proj4js.common.D2R; break;        // phi0, central latitude
            case "lat_1":  this.lat1 = paramVal*Proj4js.common.D2R; break;        //standard parallel 1
            case "lat_2":  this.lat2 = paramVal*Proj4js.common.D2R; break;        //standard parallel 2
            case "lat_ts": this.lat_ts = paramVal*Proj4js.common.D2R; break;      // used in merc and eqc
            case "lon_0":  this.long0 = paramVal*Proj4js.common.D2R; break;       // lam0, central longitude
            case "alpha":  this.alpha =  parseFloat(paramVal)*Proj4js.common.D2R; break;  //for somerc projection
            case "lonc":   this.longc = paramVal*Proj4js.common.D2R; break;       //for somerc projection
            case "x_0":    this.x0 = parseFloat(paramVal); break;  // false easting
            case "y_0":    this.y0 = parseFloat(paramVal); break;  // false northing
            case "k_0":    this.k0 = parseFloat(paramVal); break;  // projection scale factor
            case "k":      this.k0 = parseFloat(paramVal); break;  // both forms returned
            case "r_a":    this.R_A = true; break;                 // sphere--area of ellipsoid
            case "zone":   this.zone = parseInt(paramVal,10); break;  // UTM Zone
            case "south":   this.utmSouth = true; break;  // UTM north/south
            case "towgs84":this.datum_params = paramVal.split(","); break;
            case "to_meter": this.to_meter = parseFloat(paramVal); break; // cartesian scaling
            case "from_greenwich": this.from_greenwich = paramVal*Proj4js.common.D2R; break;
				// DGR 2008-07-09 : if pm is not a well-known prime meridian take
				// the value instead of 0.0, then convert to radians
            case "pm":     paramVal = paramVal.replace(/\s/gi,"");
                this.from_greenwich = Proj4js.PrimeMeridian[paramVal] ?
                    Proj4js.PrimeMeridian[paramVal] : parseFloat(paramVal);
                this.from_greenwich *= Proj4js.common.D2R;
                break;
				// DGR 2010-11-12: axis
            case "axis":   paramVal = paramVal.replace(/\s/gi,"");
                var legalAxis= "ewnsud";
                if (paramVal.length==3 &&
                    legalAxis.indexOf(paramVal.substr(0,1))!=-1 &&
                    legalAxis.indexOf(paramVal.substr(1,1))!=-1 &&
                    legalAxis.indexOf(paramVal.substr(2,1))!=-1) {
                    this.axis= paramVal;
                } //FIXME: be silent ?
                break
            case "no_defs": break;
            default: //alert("Unrecognized parameter: " + paramName);
			} // switch()
		} // for paramArray
		this.deriveConstants();
	},

	/**
	 * Function: deriveConstants
	 * Sets several derived constant values and initialization of datum and ellipse
	 *     parameters.
	 *
	 */
	deriveConstants: function() {
		if (this.nagrids == '@null') this.datumCode = 'none';
		if (this.datumCode && this.datumCode != 'none') {
			var datumDef = Proj4js.Datum[this.datumCode];
			if (datumDef) {
				this.datum_params = datumDef.towgs84 ? datumDef.towgs84.split(',') : null;
				this.ellps = datumDef.ellipse;
				this.datumName = datumDef.datumName ? datumDef.datumName : this.datumCode;
			}
		}
		if (!this.a) {    // do we have an ellipsoid?
			var ellipse = Proj4js.Ellipsoid[this.ellps] ? Proj4js.Ellipsoid[this.ellps] : Proj4js.Ellipsoid['WGS84'];
			Proj4js.extend(this, ellipse);
		}
		if (this.rf && !this.b) this.b = (1.0 - 1.0/this.rf) * this.a;
		if (this.rf === 0 || Math.abs(this.a - this.b)<Proj4js.common.EPSLN) {
			this.sphere = true;
			this.b= this.a;
		}
		this.a2 = this.a * this.a;          // used in geocentric
		this.b2 = this.b * this.b;          // used in geocentric
		this.es = (this.a2-this.b2)/this.a2;  // e ^ 2
		this.e = Math.sqrt(this.es);        // eccentricity
		if (this.R_A) {
			this.a *= 1. - this.es * (Proj4js.common.SIXTH + this.es * (Proj4js.common.RA4 + this.es * Proj4js.common.RA6));
			this.a2 = this.a * this.a;
			this.b2 = this.b * this.b;
			this.es = 0.;
		}
		this.ep2=(this.a2-this.b2)/this.b2; // used in geocentric
		if (!this.k0) this.k0 = 1.0;    //default value
		//DGR 2010-11-12: axis
		if (!this.axis) { this.axis= "enu"; }

		this.datum = new Proj4js.datum(this);
	}
});

Proj4js.Proj.longlat = {
	init: function() {
		//no-op for longlat
	},
	forward: function(pt) {
		//identity transform
		return pt;
	},
	inverse: function(pt) {
		//identity transform
		return pt;
	}
};
Proj4js.Proj.identity = Proj4js.Proj.longlat;

//lookup table to go from the projection name in WKT to the Proj4js projection name
//build this out as required
Proj4js.Proj.wktProjections = {
	"Lambert Tangential Conformal Conic Projection": "lcc",
	"Mercator": "merc",
	"Popular Visualisation Pseudo Mercator": "merc",
	"Mercator_1SP": "merc",
	"Transverse_Mercator": "tmerc",
	"Transverse Mercator": "tmerc",
	"Lambert Azimuthal Equal Area": "laea",
	"Universal Transverse Mercator System": "utm"
};

Proj4js.WGS84 = new Proj4js.Proj('WGS84',
								 "+title=long/lat:WGS84 +proj=longlat "
								 + "+ellps=WGS84 +datum=WGS84 +units=degrees");