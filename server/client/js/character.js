/* 
    ========================
        Character Object
    ========================
*/

const character = {


    deathCharacter : false,

    /* Sprites */
    currentSprite: {
        x: null,
        y: null
    },
    spriteSheet: {
        img: null,
        width: 64,
        height: 64
    },

    spriteImages: {
        normal: null,
        shooting: null
    },

    /* Animations */
    animationSpeed: 250,
    staticInterval: undefined,
    moveInterval: undefined,

    /* Matrix position */

    posY: null,
    posX: null,

    /* Load the sprites for the given character */
    load: function(name, callback) {
        let loadedImages = 0

        /* Loading normal spritesheet */
        let sprite = new Image()
        sprite.onload = () =>{
            this.spriteSheet.img = sprite
            this.spriteImages.normal = sprite

            this.currentSprite.x = 0
            this.currentSprite.y = 3

            if(++loadedImages == 2)
                callback()
        }
        sprite.src = `../assets/characters/${name}`


        /* Loading shooting spritesheet */
        let spriteShooting = new Image()

        spriteShooting.onload = () => {
            this.spriteImages.shooting = spriteShooting

            if(++loadedImages == 2)
                callback()
        }

        spriteShooting.src = `../assets/characters/shooting/${name}`


    },

    /* Change the image when moving forward */
    onMovingForward: function() {
        this.currentSprite.y = 3

        this.createInterval()
    },

    onMovingBackwards: function(){
        this.currentSprite.y = 0

        this.createInterval()
    },

    onMovingLeft: function(){
        this.currentSprite.y = 1

        this.createInterval()
    },

    onMovingRight: function(){
        this.currentSprite.y = 2

        this.createInterval()
    },

    onMovingForwardLeft: function(){
        this.currentSprite.y = 5

        this.createInterval()
    },

    onMovingForwardRight: function(){
        this.currentSprite.y = 4
        this.createInterval()
    },

    onMovingBackwardsRight: function(){
        this.currentSprite.y = 6
        this.createInterval()
    },

    onMovingBackwardsLeft: function(){
        this.currentSprite.y = 7
        this.createInterval()
    },
    
    createInterval : function(){
        this.currentSprite.x = 1
        this.moveInterval = setInterval(() =>{
            this.currentSprite.x ++

            if(this.currentSprite.x > 4) 
                this.currentSprite.x = 1

        }, this.animationSpeed)  
    },

    /* Delete  */
    onMovingStop: function(){
        clearInterval(this.moveInterval)
        this.currentSprite.x = 0
        this.moveInterval = null
    }

    
}

export default character