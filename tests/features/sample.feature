Feature: Login functionality
The login

  @env='QA' @App='AeriaLink' @data={'AeriaLink.MCH.Niche.00002','AeriaLink.MCH.Niche.00003'}
  Scenario: Navigate to the application
    Given the user navigates to the application
    When the user clicks on the webElement BTN-Login on the Landing.default page
    When the user enters a value nishan.manoraj@goconvey.com on the webElement INP-Email on the Login.default page
    When the user enters a value Surekha@123 on the webElement INP-Password on the Login.default page
    When the user right clicks the webElement BTN-SignIn on the Login.default page
    When the user double clicks the webElement BTN-SignIn on the Login.default page
    When the user clicks on the webElement BTN-SignIn on the Login.default page
