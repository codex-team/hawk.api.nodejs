import { gql } from 'apollo-server-core';

export default gql`
    """
    Authentication tokens
    """
    type TokenPair {
        """
        User's access token
        """
        accessToken: String!
        """
        User's refresh token for getting new token pair
        """
        refreshToken: String!
    }

    """
    Mutations for manipulating with User and authentication
    """
    type UserMutations {
        """
        Register user with provided email. Returns true if registered
        """
        signUp(
            """
            Registration email
            """
            email: String! @validate(isEmail: true)
        ): Boolean!

        """
        Login user with provided email and password
        """
        login(
            """
            User email
            """
            email: String! @validate(isEmail: true)

            """
            User password
            """
            password: String! @validate(notEmpty: true)
        ): TokenPair!


        """
        Update user's tokens pair
        """
        refreshTokens(
            """
            Refresh token for getting new token pair
            """
            refreshToken: String!
        ): TokenPair!

        """
        Reset user's password
        """
        resetPassword(
            """
            User email
            """
            email: String! @validate(isEmail: true)
        ): Boolean!

        """
        Change user password
        """
        changePassword(
            """
            Current user password
            """
            oldPassword: String! @validate(notEmpty: true)

            """
            New user password
            """
            newPassword: String! @validate(notEmpty: true)
        ): Boolean! @requireAuth
    }

    """
    Represent User type
    """
    type User {
        """
        User's id
        """
        id: ID! @renameFrom(name: "_id")

        """
        User's email
        """
        email: String

        """
        User's name
        """
        name: String

        """
        Date of registration
        """
        registrationDate: DateTime!

        """
        User's image
        """
        image: String
    }

    extend type Query {
        """
        Returns authenticated user data
        """
        me: User @requireAuth
    }

    extend type Mutation {
        """
        Mutations for manipulating with User and authentication
        """
        user: UserMutations!
    }
`;
