(function($) {
  $.fn.textFit = function( settings ){
    /*
      logger:
        Defaults to a null logger, you can pass console.log etc. into this instead if you want.
      shrink:
        True by default. The default algorithm is pretty rough, sometimes elements end up slightly bigger than their parent width, if 
        shrink is set true then we shrink the element to the largest possible value which is <= parent width. 
      enlarge: 
        True by default. As above, except try to get a better fit for elements that have ended up <= parent width.
      wordSpacing:
        True by default. Because % sized text gets snapped to the nearest matching point size (I think) it's often the case that even
        after the above have been done the element is still smaller than its parent. If this is the case and the text has any spaces,
        we try to add some extra spacing via CSS word-spacing to try and get the text closer to its ideal size. If there isn't enough
        unused space to add at least 1 pixel to each space in the text then it does nothing.
      letterSpacing:
        True by default. Much the same as above but attempts to use letter-spacing instead of word-spacing. This is almost always 
        pointless (there isn't enough unused space to put at least 1 extra pixel between each letter) but very occasionally it does
        help.
      padding: 
        True by default. Finally we attempt to center the text within any remaining space by adding a little left padding.
      normalizeLineHeight:
        False by default. Because each line has different leading due to fonts being different sizes it looks funny when you go from a 
        large size to a small one. This attempts to remove all the leading and then space the lines out using the provided lineSpacing,
        see below for more detail. For most people it's probably easier just to set line-height on the parent or targeted elements. 
        This is an advanced feature and you'll need to understand a few things to get it to work really nicely, see normalizeModifier, 
        normalizeAscentToCap etc. Note that the effect looks best with and is intended to be used with caps. 
      normalizeModifier:
        1 by default. Because different fonts have different metrics, if you are using normalizeLineHeight you may need to adjust this 
        if the lines are overlapping or too far apart. Values smaller than 1 will decrease the distance and greater than 1 will 
        increase it. If this still doesn't help, try changing the normalizeAscent
      normalizeAscentToCap:
        The % of the total line height taken up by the gap between the ascent line and the cap line. I chose this metric because the
        textFit effect looks best with caps. If you are really pedantic and not happy with the defaults, or just tweaking them until 
        they look OK you can figure this out by looking at the metrics of the font you're using.
        See http://www.toddroeth.com/class/images/22.jpg , from http://www.toddroeth.com/class/grph_210/
      normalizeBaseToDescent:
        As above but the % of the total line height taken up by the gap between the baseline and descent line.
      lineSpacing:
        0.25 by default. The amount in ems to space this line down from the one above it - is not applied to first line. The font size
        is taken from the parent element so that lines within the same parent stay consistent.
    */
    var config = {
      logger : function( text ) {},
      shrink : true,
      enlarge : true,
      wordSpacing: true,
      letterSpacing: true,
      padding: true,
      normalizeLineHeight: false,
      normalizeModifier: 1.5,
      normalizeAscentToCap: 28.258,
      normalizeBaseToDescent: 22.941,
      lineSpacing: 0.25
    };

    if( settings ) {
      $.extend( config, settings );
    }

    this.each(function() {
      var element = $( this );
      var width = element.parent().width();
      var content = $.trim( element.text() );
      
      config.logger( "content: {" + content + "}" );
      config.logger( "width: " + width );
            
      //Reset the element's font-size etc. so we have something constant to work with.
      element.css({
        display: "inline-block",
        fontSize: "100%", 
        whiteSpace: "nowrap",
        margin: 0,
        padding: 0
      });
      
      //Try to get the initial font size multiplier, it'll be a bit rough but it's a good start.
      var multiplier = ( width / element.outerWidth( true ) ) * 100;
      
      element.css({ fontSize: multiplier + "%" });
      
      config.logger( "initial multiplier: " + multiplier );
      config.logger( "child width after initial: " + element.outerWidth( true ) );
      
      /*
        Shrink any that are too big. If there's a potential solution it always seems to get found in less than 10 iterations so that's 
        our limit
      */
      var limit = 10;
      if( config.shrink ) {
        config.logger( "shrinking..." );
        
        for( var i = 0; i < limit; i++ ) {
          //if we've done what we came here to do, no point wasting any more cycles
          if( element.outerWidth( true ) <= width ) {
            config.logger( "shrink exited after " + i + " iterations" );
            
            break;
          }
          
          /*
            Otherwise let's recalculate the multiplier and see if we can reduce the rounding dissonance between % and pt size a 
            little more.
          */
          multiplier *= ( width / element.outerWidth( true ) );
          
          element.css({ fontSize: multiplier + "%" });
          
          if( i == limit - 1 ) config.logger( "shrinking exiting after " + limit + " iterations" );
        }
        
        config.logger( "element width after shrinking: " + element.outerWidth( true ) );
      }
      
      //Try to enlarge any that are too small, being careful not to make them bigger than the parent.
      if( config.enlarge ) {
        config.logger( "enlarging..." );
        
        //Raise the limit, sometimes finding a solution takes more than 10 tries, but it always seems to take less than 20.
        limit = 20;
        
        //Back up the multiplier we were using so that if we end up with something too big we can go back to the last one that fit.
        var reasonableMultiplier = multiplier;
        
        for( var i = 0; i < limit; i++ ) {
          //+0.5 seems to be the best step size, smaller means we need more tries and bigger means we miss some potential solutions.
          multiplier += 0.5;
          
          element.css({ fontSize: multiplier + "%" });
          
          /*
            If the number we just tried is too big, we know that the one before it was OK so break before we set reasonableMultiplier 
            to the new value.
          */
          if( element.outerWidth( true ) > width ) { 
            config.logger( "enlarge exited after " + i + " iterations" );
            
            break;
          }
          
          //If we didn't exit that means we've found a bigger size that's still small enough to fit parent, remember it.
          reasonableMultiplier = multiplier;
        }
        
        //store back into multiplier in case we need it for lineHeight
        multiplier = reasonableMultiplier;
        
        element.css({ fontSize: multiplier + "%" });
        
        config.logger( "element width after enlarging: " + element.outerWidth( true ) );
      }
      
      //OK we're much closer now. If there are spaces let's pad them out to try and use any remaining space.
      if( config.wordSpacing ) {
        config.logger( "changing word spacing..." );
        
        var currentDifference = width - element.outerWidth( true );
        
        //No point doing this if there aren't any spaces in the text or we're already the right size.
        if( currentDifference > 0 && content.indexOf( " " ) != -1 ) {
          /*
            How many spaces are there? Doing two things here, collapsing consecutive whitespace and using global search, otherwise
            content.match always stops at the first one it finds so length will always be 1.
          */
          var spaces = content.match( /\s+/g ).length;
          
          config.logger( "spaces: " + spaces );
          
          var wordSpacing = Math.floor( currentDifference / spaces );
          
          if( wordSpacing > 0 ) {
            config.logger( "wordSpacing: " + wordSpacing );
            config.logger( "difference before wordSpacing: " + currentDifference );
            
            element.css({ wordSpacing: wordSpacing + "px" });
            
            config.logger( "difference after wordSpacing: " + ( width - element.outerWidth( true ) ) );
          } else {
            config.logger( "wordSpacing won't make a difference" );
          }
        } else {
          config.logger( "no need to wordSpace, or no spaces" );
        }
      }              

      //OK we're grasping at straws here, this only helps very rarely but may as well try letter spacing too. 
      if( config.letterSpacing ) {
        config.logger( "changing letter spacing..." );
        
        currentDifference = width - element.outerWidth( true );
        
        //No point doing this if it's already the right size
        if( currentDifference > 0 ) {
          var letterSpacing = Math.floor( currentDifference / ( content.length ) );
          
          config.logger( "content length: " + content.length );
          
          if( letterSpacing > 0 ) {
            config.logger( "letterSpacing: " + letterSpacing );                
            config.logger( "difference before letterSpacing: " + currentDifference );
            
            element.css({ letterSpacing: letterSpacing + "px" });
            
            config.logger( "difference after letterSpacing: " + ( width - element.outerWidth( true ) ) );
          } else {
            config.logger( "letterSpacing won't make a difference" );
          }
        } else {
          config.logger( "no need to letterSpace" );
        }
      }
      
      //finally for trying to get width optimal, let's try to distribute the remaining space at the edges using some padding
      if( config.padding ) {
        config.logger( "changing padding..." );
        
        currentDifference = width - element.outerWidth( true );
        
        if( currentDifference > 0 ) {
          var leftPadding = Math.floor( currentDifference / 2 ) + ( currentDifference % 2 );
          
          config.logger( "leftPadding: " + leftPadding );
          config.logger( "difference before padding: " + currentDifference );
          
          element.css({ paddingLeft: leftPadding + "px" }); 
          
          config.logger( "difference after padding: " + ( width - element.outerWidth( true ) ) );                  
        } else {
          config.logger( "no need for padding" );
        }
      }
      
      //margin top? -0.25 of normal height * multiplier of above  + -0.25 of normal height * own multiplier?
      //margin-bottom -0.25 of normal height * multiplier of below + -0.25 of normal height * own multiplier?
      //element.css({ lineHeight: 0.9 });
      element.data( "multiplier", multiplier );
    });
    
    if( config.normalizeLineHeight ) {
      //this is just so dubious, no way of knowing what metrics different fonts use, different browsers, different OS...
      //still, I guess mark this option as "experimental" and let authors use it at their peril!
      var topMultiplier = config.normalizeAscentToCap / config.normalizeModifier;
      var bottomMultiplier = config.normalizeBaseToDescent / config.normalizeModifier;
      var lineHeight;
      this.each(function() {
        var element = $( this );
        var index = element.index();
        var height = element.height();
        var top = ( height * topMultiplier ) / 100;
        var bottom = ( height * bottomMultiplier ) / 100;
        var newHeight = height - Math.floor( top + bottom );
        var wrapperClass = "textfit-inner-" + index;
        //var lineSpacing = config.lineSpacing * element.parent().css( lineHeight );
        
        element.css({ height: newHeight + "px" });
        if( index == 0 ) {
          var shimId = "textFitFindParentTextSize";
          element.parent().append( '<div id="' + shimId + '" style="width: 1px; height: ' + config.lineSpacing + 'em;" />' );
          lineHeight = $( "#" + shimId ).height();
          $( "#" + shimId ).hide();
        } else {
          element.css({ marginTop: lineHeight + "px" });        
        }
        element.wrapInner( '<span class="' + wrapperClass + '" />' );
        $( "." + wrapperClass ).css({ display: "block", position: "relative", top: -top + "px", margin: 0, padding: 0 });
      });
    }

    return this;
  };
})(jQuery);